import { id } from "@instantdb/admin"
import type { WebhookDB, WebhookPayload, WebhookEventName } from "./types"
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

const MAX_ATTEMPTS = 5
const BASE_DELAY_MS = 1000

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

export const calculateBackoff = (attempt: number, baseDelay = BASE_DELAY_MS): number => {
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

  await db.transact(
    db.tx.webhookQueue[queueItemId].update({
      deliveryId,
      event,
      action: action || undefined,
      payload: rawPayload,
      status: "pending",
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  )

  return { queued: true, duplicate: false, queueItemId }
}

export const dispatchWebhookEvent = async (
  db: WebhookDB,
  event: WebhookEventName,
  payload: WebhookPayload,
): Promise<void> => {
  switch (event) {
    case "push":
      await handlePushWebhook(db, payload)
      break
    case "create":
      await handleCreateWebhook(db, payload)
      break
    case "delete":
      await handleDeleteWebhook(db, payload)
      break
    case "fork":
      await handleForkWebhook(db, payload)
      break
    case "repository":
      await handleRepositoryWebhook(db, payload)
      break
    case "pull_request":
      await handlePullRequestWebhook(db, payload)
      await handlePullRequestEventWebhook(db, payload)
      break
    case "pull_request_review":
      await handlePullRequestReviewWebhook(db, payload)
      break
    case "pull_request_review_comment":
      await handleCommentWebhook(db, payload, event)
      break
    case "issues":
      await handleIssueWebhook(db, payload)
      break
    case "issue_comment": {
      const issue = payload.issue as Record<string, unknown> | undefined
      if (issue?.pull_request) {
        await handleCommentWebhook(db, payload, event)
      } else {
        await handleIssueCommentWebhook(db, payload)
      }
      break
    }
    case "star":
      await handleStarWebhook(db, payload)
      break
    case "organization":
      await handleOrganizationWebhook(db, payload)
      break
    case "check_run":
      await handleCheckRunWebhook(db, payload)
      break
    case "check_suite":
      await handleCheckSuiteWebhook(db, payload)
      break
    case "status":
      await handleStatusWebhook(db, payload)
      break
    case "workflow_run":
      await handleWorkflowRunWebhook(db, payload)
      break
    case "workflow_job":
      await handleWorkflowJobWebhook(db, payload)
      break
    case "public":
    case "repository_import":
    case "repository_dispatch":
    case "pull_request_review_thread":
    case "deployment":
    case "deployment_status":
    case "deployment_protection_rule":
    case "deployment_review":
    case "workflow_dispatch":
    case "code_scanning_alert":
    case "dependabot_alert":
    case "secret_scanning_alert":
    case "secret_scanning_alert_location":
    case "security_advisory":
    case "repository_vulnerability_alert":
    case "security_and_analysis":
    case "member":
    case "membership":
    case "org_block":
    case "team":
    case "team_add":
    case "installation":
    case "installation_repositories":
    case "installation_target":
    case "github_app_authorization":
    case "discussion":
    case "discussion_comment":
    case "project":
    case "project_card":
    case "project_column":
    case "projects_v2_item":
    case "branch_protection_rule":
    case "branch_protection_configuration":
    case "merge_group":
    case "deploy_key":
    case "release":
    case "watch":
    case "label":
    case "milestone":
    case "meta":
    case "page_build":
    case "commit_comment":
    case "gollum":
    case "package":
    case "registry_package":
    case "sponsorship":
    case "marketplace_purchase":
    case "custom_property":
    case "custom_property_values":
      await handleExtendedWebhook(db, payload, event)
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

  await db.transact(
    db.tx.webhookQueue[item.id].update({
      status: "processing",
      attempts: item.attempts + 1,
      updatedAt: now,
    }),
  )

  try {
    const payload = JSON.parse(item.payload) as WebhookPayload
    await dispatchWebhookEvent(db, item.event as WebhookEventName, payload)

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
    const result = await processQueueItem(db, item as unknown as WebhookQueueItem)
    if (result.success) {
      processed++
    } else {
      failed++
    }
  }

  return { processed, failed, total: dueItems.length }
}
