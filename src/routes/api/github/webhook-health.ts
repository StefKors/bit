import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { requireWebhookOpsAuth } from "@/lib/webhooks/ops-auth"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

type WebhookQueueHealthLevel = "ok" | "warning" | "critical"
type WebhookQueueAlertCode =
  | "pending_backlog_warning"
  | "pending_backlog_critical"
  | "oldest_pending_warning"
  | "oldest_pending_critical"
  | "dead_letter_warning"
  | "dead_letter_critical"
  | "dead_letter_growth_warning"
  | "dead_letter_growth_critical"
  | "processor_stale_warning"
  | "processor_stale_critical"

type WebhookQueueHealthAlert = {
  code: WebhookQueueAlertCode
  level: Exclude<WebhookQueueHealthLevel, "ok">
  message: string
  value: number
  threshold: number
}

type WebhookQueueItem = {
  status?: string
  createdAt: number
  processedAt?: number
  failedAt?: number
}

export type WebhookQueueHealthSnapshot = {
  health: WebhookQueueHealthLevel
  alerts: WebhookQueueHealthAlert[]
  queue: {
    pending: number
    processing: number
    failed: number
    deadLetter: number
    oldestPendingAgeMs: number
    lastProcessedAt: number | null
  }
}

const WARNING_PENDING = 1_000
const CRITICAL_PENDING = 10_000
const WARNING_OLDEST_PENDING_AGE_MS = 5 * 60 * 1000
const CRITICAL_OLDEST_PENDING_AGE_MS = 30 * 60 * 1000
const WARNING_DEAD_LETTER = 25
const CRITICAL_DEAD_LETTER = 100
const DEAD_LETTER_GROWTH_WINDOW_MS = 10 * 60 * 1000
const WARNING_DEAD_LETTER_GROWTH = 25
const CRITICAL_DEAD_LETTER_GROWTH = 100
const WARNING_PROCESSOR_STALE_MS = 5 * 60 * 1000
const CRITICAL_PROCESSOR_STALE_MS = 15 * 60 * 1000

const addAlert = (
  alerts: WebhookQueueHealthAlert[],
  code: WebhookQueueAlertCode,
  level: Exclude<WebhookQueueHealthLevel, "ok">,
  message: string,
  value: number,
  threshold: number,
): void => {
  alerts.push({ code, level, message, value, threshold })
}

export const deriveWebhookQueueHealth = (
  items: WebhookQueueItem[],
  now = Date.now(),
): WebhookQueueHealthSnapshot => {
  const pendingItems = items.filter((i) => i.status === "pending")
  const processingItems = items.filter((i) => i.status === "processing")
  const failedItems = items.filter((i) => i.status === "failed")
  const deadLetterItems = items.filter((i) => i.status === "dead_letter")
  const processedItems = items.filter((i) => i.status === "processed")

  const oldestPending = pendingItems.reduce(
    (oldest, item) => (item.createdAt < oldest ? item.createdAt : oldest),
    Infinity,
  )
  const oldestPendingAgeMs = oldestPending === Infinity ? 0 : Math.max(0, now - oldestPending)

  const lastProcessedAt = processedItems.reduce(
    (latest, item) => Math.max(latest, item.processedAt ?? 0),
    0,
  )
  const lastProcessedAtOrNull = lastProcessedAt > 0 ? lastProcessedAt : null

  const recentDeadLetterCount = deadLetterItems.filter(
    (item) => item.failedAt && now - item.failedAt <= DEAD_LETTER_GROWTH_WINDOW_MS,
  ).length

  const alerts: WebhookQueueHealthAlert[] = []

  if (pendingItems.length > CRITICAL_PENDING) {
    addAlert(
      alerts,
      "pending_backlog_critical",
      "critical",
      "Pending webhook backlog is critically high",
      pendingItems.length,
      CRITICAL_PENDING,
    )
  } else if (pendingItems.length > WARNING_PENDING) {
    addAlert(
      alerts,
      "pending_backlog_warning",
      "warning",
      "Pending webhook backlog exceeded warning threshold",
      pendingItems.length,
      WARNING_PENDING,
    )
  }

  if (oldestPendingAgeMs > CRITICAL_OLDEST_PENDING_AGE_MS) {
    addAlert(
      alerts,
      "oldest_pending_critical",
      "critical",
      "Oldest pending webhook age is critically high",
      oldestPendingAgeMs,
      CRITICAL_OLDEST_PENDING_AGE_MS,
    )
  } else if (oldestPendingAgeMs > WARNING_OLDEST_PENDING_AGE_MS) {
    addAlert(
      alerts,
      "oldest_pending_warning",
      "warning",
      "Oldest pending webhook age exceeded warning threshold",
      oldestPendingAgeMs,
      WARNING_OLDEST_PENDING_AGE_MS,
    )
  }

  if (deadLetterItems.length > CRITICAL_DEAD_LETTER) {
    addAlert(
      alerts,
      "dead_letter_critical",
      "critical",
      "Dead-letter queue size is critically high",
      deadLetterItems.length,
      CRITICAL_DEAD_LETTER,
    )
  } else if (deadLetterItems.length > WARNING_DEAD_LETTER) {
    addAlert(
      alerts,
      "dead_letter_warning",
      "warning",
      "Dead-letter queue size exceeded warning threshold",
      deadLetterItems.length,
      WARNING_DEAD_LETTER,
    )
  }

  if (recentDeadLetterCount > CRITICAL_DEAD_LETTER_GROWTH) {
    addAlert(
      alerts,
      "dead_letter_growth_critical",
      "critical",
      "Dead-letter growth in recent window is critically high",
      recentDeadLetterCount,
      CRITICAL_DEAD_LETTER_GROWTH,
    )
  } else if (recentDeadLetterCount > WARNING_DEAD_LETTER_GROWTH) {
    addAlert(
      alerts,
      "dead_letter_growth_warning",
      "warning",
      "Dead-letter growth in recent window exceeded warning threshold",
      recentDeadLetterCount,
      WARNING_DEAD_LETTER_GROWTH,
    )
  }

  const processorAgeMs = lastProcessedAtOrNull ? now - lastProcessedAtOrNull : Infinity
  if (processorAgeMs > CRITICAL_PROCESSOR_STALE_MS) {
    addAlert(
      alerts,
      "processor_stale_critical",
      "critical",
      "Webhook processor appears stale",
      Number.isFinite(processorAgeMs) ? processorAgeMs : CRITICAL_PROCESSOR_STALE_MS + 1,
      CRITICAL_PROCESSOR_STALE_MS,
    )
  } else if (processorAgeMs > WARNING_PROCESSOR_STALE_MS) {
    addAlert(
      alerts,
      "processor_stale_warning",
      "warning",
      "Webhook processor has not processed items recently",
      processorAgeMs,
      WARNING_PROCESSOR_STALE_MS,
    )
  }

  const health: WebhookQueueHealthLevel = alerts.some((a) => a.level === "critical")
    ? "critical"
    : alerts.some((a) => a.level === "warning")
      ? "warning"
      : "ok"

  return {
    health,
    alerts,
    queue: {
      pending: pendingItems.length,
      processing: processingItems.length,
      failed: failedItems.length,
      deadLetter: deadLetterItems.length,
      oldestPendingAgeMs,
      lastProcessedAt: lastProcessedAtOrNull,
    },
  }
}

export const Route = createFileRoute("/api/github/webhook-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const unauthorized = requireWebhookOpsAuth(request)
          if (unauthorized) return unauthorized

          const now = Date.now()

          const { webhookQueue: allItems } = await adminDb.query({
            webhookQueue: {},
          })
          const snapshot = deriveWebhookQueueHealth(allItems || [], now)

          return jsonResponse({
            status: snapshot.health,
            health: snapshot.health,
            alerts: snapshot.alerts,
            queue: snapshot.queue,
            timestamp: now,
          })
        } catch (error) {
          return jsonResponse(
            { status: "error", error: error instanceof Error ? error.message : "Unknown error" },
            500,
          )
        }
      },
    },
  },
})
