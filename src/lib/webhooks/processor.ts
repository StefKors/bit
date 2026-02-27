import { id } from "@instantdb/admin"
import type { IssueCommentEvent, WebhookDB, WebhookEventName, WebhookPayload } from "./types"
import {
  handlePullRequestWebhook,
  handlePullRequestReviewWebhook,
  handleCommentWebhook,
  handlePushWebhook,
  handleRepositoryWebhook,
  handleStarWebhook,
  handleForkWebhook,
  handleOrganizationWebhook,
  handleCreateWebhook,
  handleDeleteWebhook,
  handlePullRequestEventWebhook,
  handleIssueWebhook,
  handleIssueCommentWebhook,
  handleExtendedWebhook,
} from "./index"
import { handleCheckRunWebhook, handleCheckSuiteWebhook } from "./ci-cd"
import { handleStatusWebhook } from "./ci-cd"
import { handleWorkflowRunWebhook, handleWorkflowJobWebhook } from "./ci-cd"
import { log } from "@/lib/logger"
import {
  logWebhookProcessing,
  logWebhookHandler,
  logWebhookPath,
  logWebhookQueueLifecycle,
} from "./logging"
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_BASE_DELAY_MS,
  WEBHOOK_PROCESS_BATCH_SIZE,
  WEBHOOK_PROCESS_MAX_LOOPS,
  WEBHOOK_PROCESS_MAX_RUN_MS,
  WEBHOOK_PROCESS_SELECTION_MULTIPLIER,
  WEBHOOK_PROCESSING_TIMEOUT_MS,
} from "@/lib/sync-config"

export const EXTENDED_WEBHOOK_EVENTS = [
  "public",
  "repository_import",
  "repository_dispatch",
  "pull_request_review_thread",
  "deployment",
  "deployment_status",
  "deployment_protection_rule",
  "deployment_review",
  "workflow_dispatch",
  "code_scanning_alert",
  "dependabot_alert",
  "secret_scanning_alert",
  "secret_scanning_alert_location",
  "security_advisory",
  "repository_vulnerability_alert",
  "security_and_analysis",
  "member",
  "membership",
  "org_block",
  "team",
  "team_add",
  "installation",
  "installation_repositories",
  "installation_target",
  "github_app_authorization",
  "discussion",
  "discussion_comment",
  "project",
  "project_card",
  "project_column",
  "projects_v2_item",
  "branch_protection_rule",
  "branch_protection_configuration",
  "merge_group",
  "deploy_key",
  "release",
  "watch",
  "label",
  "milestone",
  "meta",
  "page_build",
  "commit_comment",
  "gollum",
  "package",
  "registry_package",
  "sponsorship",
  "marketplace_purchase",
  "custom_property",
  "custom_property_values",
] as const satisfies readonly WebhookEventName[]

const extendedWebhookEventSet = new Set<WebhookEventName>(EXTENDED_WEBHOOK_EVENTS)

const isExtendedWebhookEvent = (
  event: WebhookEventName,
): event is (typeof EXTENDED_WEBHOOK_EVENTS)[number] => extendedWebhookEventSet.has(event)

const isIssueCommentEventPayload = (payload: WebhookPayload): payload is IssueCommentEvent =>
  typeof payload === "object" && payload !== null && "issue" in payload && "comment" in payload

export type WebhookQueueItem = {
  id: string
  deliveryId: string
  event: string
  action?: string
  payload: string
  status: string
  attempts: number
  maxAttempts: number
  nextRetryAt?: number
  lastError?: string
  processedAt?: number
  failedAt?: number
  createdAt: number
  updatedAt: number
}

export type EnqueueResult = {
  queued: boolean
  duplicate: boolean
  queueItemId?: string
}

type QueueSkipReason = "retry_not_due" | "batch_limit_reached" | "stale_processing_recovered"

export type ProcessPendingQueueResult = {
  processed: number
  failed: number
  total: number
  selected: number
  skippedNotDue: number
  recoveredStaleProcessing: number
  loops: number
  timedOut: boolean
  reasonCounts: Record<QueueSkipReason, number>
}

let activeProcessorRun: Promise<void> | null = null
let queuedProcessorRun = false

const createReasonCounts = (): Record<QueueSkipReason, number> => ({
  retry_not_due: 0,
  batch_limit_reached: 0,
  stale_processing_recovered: 0,
})

export const calculateBackoff = (attempt: number, baseDelay = WEBHOOK_BASE_DELAY_MS): number => {
  const exponential = baseDelay * 2 ** attempt
  const jitter = Math.floor(Math.random() * baseDelay)
  return exponential + jitter
}

export const enqueueWebhook = async (
  db: WebhookDB,
  deliveryId: string,
  event: string,
  action: string | undefined,
  rawPayload: string,
): Promise<EnqueueResult> => {
  const [{ webhookDeliveries: existing }, { webhookQueue: existingQueue }] = await Promise.all([
    db.query({
      webhookDeliveries: {
        $: { where: { deliveryId }, limit: 1 },
      },
    }),
    db.query({
      webhookQueue: {
        $: { where: { deliveryId }, limit: 1 },
      },
    }),
  ])
  if (existing?.[0] || existingQueue?.[0]) {
    return { queued: false, duplicate: true }
  }

  const queueItemId = id()
  const now = Date.now()

  try {
    await db.transact(
      db.tx.webhookQueue[queueItemId].update({
        deliveryId,
        event,
        action: action || undefined,
        payload: rawPayload,
        status: "pending",
        attempts: 0,
        maxAttempts: WEBHOOK_MAX_ATTEMPTS,
        nextRetryAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("record-not-unique") || message.includes("unique")) {
      return { queued: false, duplicate: true }
    }
    throw err
  }

  logWebhookQueueLifecycle("enqueued", {
    queueItemId,
    deliveryId,
    event,
    action,
    queueAgeMs: 0,
    attempt: 0,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
  })

  return { queued: true, duplicate: false, queueItemId }
}

export const dispatchWebhookEvent = async (
  db: WebhookDB,
  event: WebhookEventName,
  payload: WebhookPayload,
): Promise<void> => {
  const deliveryId =
    typeof payload === "object" && payload !== null && "deliveryId" in payload
      ? String((payload as { deliveryId?: string }).deliveryId)
      : undefined
  const action =
    typeof payload === "object" && payload !== null && "action" in payload
      ? ((payload as { action?: string }).action ?? undefined)
      : undefined

  logWebhookPath("dispatch event", 0, { deliveryId, event, action })

  if (isExtendedWebhookEvent(event)) {
    logWebhookPath("route -> handleExtendedWebhook", 1, { deliveryId, event, action })
    logWebhookHandler(event, "handleExtendedWebhook", ["prEvents", "prComments"], {
      repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
    })
    await handleExtendedWebhook(db, payload, event)
    logWebhookPath("handler done -> handleExtendedWebhook", 1, { deliveryId, event, action })
    return
  }

  switch (event) {
    case "push":
      logWebhookHandler(
        event,
        "handlePushWebhook",
        ["repos", "prCommits", "pullRequests", "repoTrees"],
        {
          repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
          ref: (payload as { ref?: string }).ref,
          commitsCount: (payload as { commits?: unknown[] }).commits?.length ?? 0,
        },
      )
      await handlePushWebhook(db, payload)
      break
    case "create":
      logWebhookHandler(event, "handleCreateWebhook", ["repos"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        refType: (payload as { ref_type?: string }).ref_type,
        ref: (payload as { ref?: string }).ref,
      })
      await handleCreateWebhook(db, payload)
      break
    case "delete":
      logWebhookHandler(event, "handleDeleteWebhook", ["repoTrees"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        refType: (payload as { ref_type?: string }).ref_type,
        ref: (payload as { ref?: string }).ref,
      })
      await handleDeleteWebhook(db, payload)
      break
    case "fork":
      logWebhookHandler(event, "handleForkWebhook", ["repos"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        forkee: (payload as { forkee?: { full_name?: string } }).forkee?.full_name,
      })
      await handleForkWebhook(db, payload)
      break
    case "repository":
      logWebhookHandler(event, "handleRepositoryWebhook", ["repos"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        action: (payload as { action?: string }).action,
      })
      await handleRepositoryWebhook(db, payload)
      break
    case "pull_request":
      logWebhookHandler(
        event,
        "handlePullRequestWebhook+handlePullRequestEventWebhook",
        ["pullRequests", "prEvents"],
        {
          repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
          pr: (payload as { pull_request?: { number?: number } }).pull_request?.number,
          action: (payload as { action?: string }).action,
        },
      )
      await Promise.all([
        handlePullRequestWebhook(db, payload),
        handlePullRequestEventWebhook(db, payload),
      ])
      break
    case "pull_request_review":
      logWebhookHandler(event, "handlePullRequestReviewWebhook", ["prReviews"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        pr: (payload as { pull_request?: { number?: number } }).pull_request?.number,
      })
      await handlePullRequestReviewWebhook(db, payload)
      break
    case "pull_request_review_comment":
      logWebhookHandler(event, "handleCommentWebhook", ["prComments"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        pr: (payload as { pull_request?: { number?: number } }).pull_request?.number,
      })
      await handleCommentWebhook(db, payload, event)
      break
    case "issues":
      logWebhookHandler(event, "handleIssueWebhook", ["issues"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        issue: (payload as { issue?: { number?: number } }).issue?.number,
        action: (payload as { action?: string }).action,
      })
      await handleIssueWebhook(db, payload)
      break
    case "issue_comment": {
      if (isIssueCommentEventPayload(payload) && payload.issue.pull_request) {
        logWebhookHandler(event, "handleCommentWebhook", ["prComments"], {
          repo: payload.repository?.full_name,
          pr: payload.issue?.number,
        })
        await handleCommentWebhook(db, payload, event)
      } else {
        logWebhookHandler(event, "handleIssueCommentWebhook", ["issueComments"], {
          repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
          issue: (payload as { issue?: { number?: number } }).issue?.number,
        })
        await handleIssueCommentWebhook(db, payload)
      }
      break
    }
    case "star":
      logWebhookHandler(event, "handleStarWebhook", ["repos"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
        action: (payload as { action?: string }).action,
      })
      await handleStarWebhook(db, payload)
      break
    case "organization":
      logWebhookHandler(event, "handleOrganizationWebhook", ["organizations", "repos"], {
        org: (payload as { organization?: { login?: string } }).organization?.login,
        action: (payload as { action?: string }).action,
      })
      await handleOrganizationWebhook(db, payload)
      break
    case "check_run":
      logWebhookHandler(event, "handleCheckRunWebhook", ["prChecks"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
      })
      await handleCheckRunWebhook(db, payload)
      break
    case "check_suite":
      logWebhookHandler(event, "handleCheckSuiteWebhook", ["prChecks"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
      })
      await handleCheckSuiteWebhook(db, payload)
      break
    case "status":
      logWebhookHandler(event, "handleStatusWebhook", ["prChecks"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
      })
      await handleStatusWebhook(db, payload)
      break
    case "workflow_run":
      logWebhookHandler(event, "handleWorkflowRunWebhook", ["prChecks"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
      })
      await handleWorkflowRunWebhook(db, payload)
      break
    case "workflow_job":
      logWebhookPath("route -> handleWorkflowJobWebhook", 1, { deliveryId, event, action })
      logWebhookHandler(event, "handleWorkflowJobWebhook", ["prChecks"], {
        repo: (payload as { repository?: { full_name?: string } }).repository?.full_name,
      })
      await handleWorkflowJobWebhook(db, payload)
      logWebhookPath("handler done -> handleWorkflowJobWebhook", 1, { deliveryId, event, action })
      break
    case "ping":
      log.info("Received ping webhook - webhook is configured correctly")
      break
    default: {
      const unhandledEvent = String(event)
      log.info(`Unhandled webhook event: ${unhandledEvent}`)
    }
  }
}

export const processQueueItem = async (
  db: WebhookDB,
  item: WebhookQueueItem,
): Promise<{ success: boolean; error?: string }> => {
  const startedAt = Date.now()
  const queueAgeMs = Math.max(0, startedAt - item.createdAt)
  const attempt = item.attempts + 1
  let failureStage: "payload_parse" | "dispatch_event" | "persist_success" = "payload_parse"

  logWebhookPath("queue item picked", 0, {
    deliveryId: item.deliveryId,
    event: item.event,
    action: item.action,
    attempts: item.attempts,
  })
  logWebhookQueueLifecycle("processing_started", {
    queueItemId: item.id,
    deliveryId: item.deliveryId,
    event: item.event,
    action: item.action,
    queueAgeMs,
    attempt,
    maxAttempts: item.maxAttempts,
  })

  await db.transact(
    db.tx.webhookQueue[item.id].update({
      status: "processing",
      attempts: attempt,
      updatedAt: startedAt,
    }),
  )

  try {
    const payload = JSON.parse(item.payload) as WebhookPayload
    logWebhookPath("payload parsed", 1, {
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
    })
    logWebhookProcessing(item.deliveryId, item.event, item.action, payload)
    logWebhookPath("dispatch start", 1, {
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
    })
    failureStage = "dispatch_event"
    await dispatchWebhookEvent(db, item.event as WebhookEventName, payload)
    logWebhookPath("dispatch complete", 1, {
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
    })

    failureStage = "persist_success"
    await db.transact([
      db.tx.webhookQueue[item.id].update({
        status: "processed",
        processedAt: startedAt,
        updatedAt: startedAt,
      }),
      db.tx.webhookDeliveries[id()].update({
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action || undefined,
        status: "processed",
        processedAt: startedAt,
      }),
    ])

    logWebhookPath("queue+delivery records upserted", 1, {
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
      entity: "webhookQueue+webhookDeliveries",
    })

    log.info("Webhook processed", {
      deliveryId: item.deliveryId,
      event: item.event,
      attempt,
    })
    logWebhookQueueLifecycle("processed", {
      queueItemId: item.id,
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
      queueAgeMs,
      attempt,
      maxAttempts: item.maxAttempts,
      processingDurationMs: Date.now() - startedAt,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (attempt >= item.maxAttempts) {
      await db.transact([
        db.tx.webhookQueue[item.id].update({
          status: "dead_letter",
          lastError: errorMessage,
          failedAt: startedAt,
          updatedAt: startedAt,
        }),
        db.tx.webhookDeliveries[id()].update({
          deliveryId: item.deliveryId,
          event: item.event,
          action: item.action || undefined,
          status: "failed",
          error: errorMessage,
          payload: item.payload,
          processedAt: startedAt,
        }),
      ])

      log.error("Webhook dead-lettered after max attempts", error, {
        queueItemId: item.id,
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action,
        attempts: attempt,
        maxAttempts: item.maxAttempts,
        failureStage,
        queueAgeMs,
        processingDurationMs: Date.now() - startedAt,
      })
      logWebhookQueueLifecycle("dead_lettered", {
        queueItemId: item.id,
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action,
        queueAgeMs,
        attempt,
        maxAttempts: item.maxAttempts,
        error: errorMessage,
        failureStage,
        processingDurationMs: Date.now() - startedAt,
      })
    } else {
      const backoff = calculateBackoff(attempt)
      const nextRetryAt = startedAt + backoff
      await db.transact(
        db.tx.webhookQueue[item.id].update({
          status: "failed",
          lastError: errorMessage,
          failedAt: startedAt,
          nextRetryAt,
          updatedAt: startedAt,
        }),
      )

      log.warn("Webhook processing failed; retry scheduled", {
        queueItemId: item.id,
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action,
        attempt,
        maxAttempts: item.maxAttempts,
        failureStage,
        error: errorMessage,
        nextRetryIn: `${backoff}ms`,
        nextRetryAt,
        queueAgeMs,
        processingDurationMs: Date.now() - startedAt,
      })
      logWebhookQueueLifecycle("retry_scheduled", {
        queueItemId: item.id,
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action,
        queueAgeMs,
        attempt,
        maxAttempts: item.maxAttempts,
        timeUntilRetryMs: backoff,
        error: errorMessage,
        failureStage,
        nextRetryAt,
        processingDurationMs: Date.now() - startedAt,
      })
    }

    return { success: false, error: errorMessage }
  }
}

export const recoverStaleProcessingItems = async (
  db: WebhookDB,
  now = Date.now(),
  timeoutMs = WEBHOOK_PROCESSING_TIMEOUT_MS,
  limit = WEBHOOK_PROCESS_BATCH_SIZE,
): Promise<number> => {
  const cutoff = now - timeoutMs
  const { webhookQueue } = await db.query({
    webhookQueue: {
      $: {
        where: { status: "processing" },
        order: { createdAt: "asc" },
        limit,
      },
    },
  })

  const staleItems = (webhookQueue || []).filter((item) => item.updatedAt <= cutoff)
  if (staleItems.length === 0) return 0

  const txs = staleItems.map((item) =>
    db.tx.webhookQueue[item.id].update({
      status: "failed",
      lastError: "Recovered stale processing item",
      failedAt: now,
      nextRetryAt: now,
      updatedAt: now,
    }),
  )
  await db.transact(txs)

  for (const item of staleItems) {
    logWebhookQueueLifecycle("skipped_not_due", {
      queueItemId: item.id,
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
      queueAgeMs: Math.max(0, now - item.createdAt),
      attempt: item.attempts,
      maxAttempts: item.maxAttempts,
      reason: "stale_processing_recovered",
    })
  }

  return staleItems.length
}

export const processPendingQueue = async (
  db: WebhookDB,
  limit = WEBHOOK_PROCESS_BATCH_SIZE,
): Promise<ProcessPendingQueueResult> => {
  const startedAt = Date.now()
  const batchSize = Math.max(1, limit)
  const maxLoops = Math.max(1, WEBHOOK_PROCESS_MAX_LOOPS)
  const maxRunMs = Math.max(1000, WEBHOOK_PROCESS_MAX_RUN_MS)
  const selectionLimit = Math.max(
    batchSize,
    batchSize * Math.max(1, WEBHOOK_PROCESS_SELECTION_MULTIPLIER),
  )

  const reasonCounts = createReasonCounts()
  let processed = 0
  let failed = 0
  let selected = 0
  let skippedNotDue = 0
  let loops = 0

  const recoveredStaleProcessing = await recoverStaleProcessingItems(db)
  if (recoveredStaleProcessing > 0) {
    reasonCounts.stale_processing_recovered += recoveredStaleProcessing
  }

  while (loops < maxLoops && Date.now() - startedAt < maxRunMs) {
    loops += 1
    const now = Date.now()
    const { webhookQueue } = await db.query({
      webhookQueue: {
        $: {
          where: {
            or: [{ status: "pending" }, { status: "failed" }],
          },
          order: { createdAt: "asc" },
          limit: selectionLimit,
        },
      },
    })

    const candidates = (webhookQueue || []) as WebhookQueueItem[]
    if (candidates.length === 0) break

    const dueItems: WebhookQueueItem[] = []
    for (const item of candidates) {
      const queueAgeMs = Math.max(0, now - item.createdAt)
      selected += 1
      logWebhookQueueLifecycle("selected", {
        queueItemId: item.id,
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action,
        queueAgeMs,
        attempt: item.attempts,
        maxAttempts: item.maxAttempts,
      })

      if (item.nextRetryAt && item.nextRetryAt > now) {
        const timeUntilRetryMs = item.nextRetryAt - now
        skippedNotDue += 1
        reasonCounts.retry_not_due += 1
        logWebhookQueueLifecycle("skipped_not_due", {
          queueItemId: item.id,
          deliveryId: item.deliveryId,
          event: item.event,
          action: item.action,
          queueAgeMs,
          attempt: item.attempts,
          maxAttempts: item.maxAttempts,
          reason: "retry_not_due",
          timeUntilRetryMs,
        })
        continue
      }

      if (dueItems.length >= batchSize) {
        skippedNotDue += 1
        reasonCounts.batch_limit_reached += 1
        logWebhookQueueLifecycle("skipped_not_due", {
          queueItemId: item.id,
          deliveryId: item.deliveryId,
          event: item.event,
          action: item.action,
          queueAgeMs,
          attempt: item.attempts,
          maxAttempts: item.maxAttempts,
          reason: "batch_limit_reached",
        })
        continue
      }

      dueItems.push(item)
    }

    if (dueItems.length === 0) {
      // Nothing due in this selection window; stop and wait for retries to mature.
      break
    }

    for (const item of dueItems) {
      const result = await processQueueItem(db, item)
      if (result.success) {
        processed += 1
      } else {
        failed += 1
      }
    }
  }

  const timedOut = Date.now() - startedAt >= maxRunMs
  const result: ProcessPendingQueueResult = {
    processed,
    failed,
    total: processed + failed,
    selected,
    skippedNotDue,
    recoveredStaleProcessing,
    loops,
    timedOut,
    reasonCounts,
  }

  log.info("Webhook processor run summary", {
    op: "webhook-process-summary",
    entity: "webhookQueue",
    ...result,
    durationMs: Date.now() - startedAt,
  })

  return result
}

export const triggerWebhookProcessor = (db: WebhookDB): void => {
  const startRun = (): void => {
    activeProcessorRun = (async () => {
      try {
        await processPendingQueue(db)
      } catch (error) {
        log.error("Auto webhook processor run failed", error, {
          op: "webhook-process-trigger",
        })
      } finally {
        activeProcessorRun = null
        if (queuedProcessorRun) {
          queuedProcessorRun = false
          startRun()
        }
      }
    })()
  }

  if (activeProcessorRun) {
    queuedProcessorRun = true
    log.info("Webhook processor already running; queued follow-up run", {
      op: "webhook-process-trigger",
    })
    return
  }

  log.info("Webhook processor auto-triggered", {
    op: "webhook-process-trigger",
  })
  startRun()
}
