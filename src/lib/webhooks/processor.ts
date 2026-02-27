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
import { logWebhookProcessing, logWebhookHandler, logWebhookPath } from "./logging"
import { WEBHOOK_MAX_ATTEMPTS, WEBHOOK_BASE_DELAY_MS } from "@/lib/sync-config"

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
  const { webhookDeliveries: existing } = await db.query({
    webhookDeliveries: {
      $: { where: { deliveryId }, limit: 1 },
    },
  })
  if (existing?.[0]) {
    return { queued: false, duplicate: true }
  }

  const { webhookQueue: existingQueue } = await db.query({
    webhookQueue: {
      $: { where: { deliveryId }, limit: 1 },
    },
  })
  if (existingQueue?.[0]) {
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
      await handlePullRequestWebhook(db, payload)
      await handlePullRequestEventWebhook(db, payload)
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
  const now = Date.now()

  logWebhookPath("queue item picked", 0, {
    deliveryId: item.deliveryId,
    event: item.event,
    action: item.action,
    attempts: item.attempts,
  })

  await db.transact(
    db.tx.webhookQueue[item.id].update({
      status: "processing",
      attempts: item.attempts + 1,
      updatedAt: now,
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
    await dispatchWebhookEvent(db, item.event as WebhookEventName, payload)
    logWebhookPath("dispatch complete", 1, {
      deliveryId: item.deliveryId,
      event: item.event,
      action: item.action,
    })

    await db.transact([
      db.tx.webhookQueue[item.id].update({
        status: "processed",
        processedAt: now,
        updatedAt: now,
      }),
      db.tx.webhookDeliveries[id()].update({
        deliveryId: item.deliveryId,
        event: item.event,
        action: item.action || undefined,
        status: "processed",
        processedAt: now,
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
      attempt: item.attempts + 1,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const newAttempts = item.attempts + 1

    if (newAttempts >= item.maxAttempts) {
      await db.transact([
        db.tx.webhookQueue[item.id].update({
          status: "dead_letter",
          lastError: errorMessage,
          failedAt: now,
          updatedAt: now,
        }),
        db.tx.webhookDeliveries[id()].update({
          deliveryId: item.deliveryId,
          event: item.event,
          action: item.action || undefined,
          status: "failed",
          error: errorMessage,
          payload: item.payload,
          processedAt: now,
        }),
      ])

      log.error("Webhook dead-lettered after max attempts", error, {
        deliveryId: item.deliveryId,
        event: item.event,
        attempts: newAttempts,
      })
    } else {
      const backoff = calculateBackoff(newAttempts)
      await db.transact(
        db.tx.webhookQueue[item.id].update({
          status: "failed",
          lastError: errorMessage,
          failedAt: now,
          nextRetryAt: now + backoff,
          updatedAt: now,
        }),
      )

      log.warn("Webhook processing failed, will retry", {
        deliveryId: item.deliveryId,
        event: item.event,
        attempt: newAttempts,
        nextRetryIn: `${backoff}ms`,
      })
    }

    return { success: false, error: errorMessage }
  }
}

export const processPendingQueue = async (
  db: WebhookDB,
  limit = 10,
): Promise<{ processed: number; failed: number; total: number }> => {
  const now = Date.now()

  const { webhookQueue: pendingItems } = await db.query({
    webhookQueue: {
      $: {
        where: {
          or: [{ status: "pending" }, { status: "failed" }],
        },
        limit,
      },
    },
  })

  const dueItems = (pendingItems || []).filter(
    (item) => !item.nextRetryAt || item.nextRetryAt <= now,
  )

  let processed = 0
  let failed = 0

  for (const item of dueItems) {
    const result = await processQueueItem(db, item as WebhookQueueItem)
    if (result.success) {
      processed++
    } else {
      failed++
    }
  }

  return { processed, failed, total: dueItems.length }
}
