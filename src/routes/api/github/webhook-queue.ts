import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"
import { WEBHOOK_CLEANUP_MAX_DELETE } from "@/lib/sync-config"
import { requireWebhookOpsAuth } from "@/lib/webhooks/ops-auth"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const CLEANUP_PROCESSED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const CLEANUP_DEAD_LETTER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type QueueCleanupItem = {
  id: string
  status?: string
  createdAt: number
  processedAt?: number
  failedAt?: number
}

export const selectWebhookQueueCleanupCandidates = (
  items: QueueCleanupItem[],
  now: number,
  maxDelete: number,
): {
  toDelete: QueueCleanupItem[]
  matched: number
  processedCandidates: number
  deadLetterCandidates: number
} => {
  const processedCutoff = now - CLEANUP_PROCESSED_RETENTION_MS
  const deadLetterCutoff = now - CLEANUP_DEAD_LETTER_RETENTION_MS

  const processedCandidates = items.filter(
    (item) =>
      item.status === "processed" && (item.processedAt ?? item.createdAt) <= processedCutoff,
  )
  const deadLetterCandidates = items.filter(
    (item) =>
      item.status === "dead_letter" && (item.failedAt ?? item.createdAt) <= deadLetterCutoff,
  )
  const matchedItems = [...processedCandidates, ...deadLetterCandidates].sort(
    (a, b) => a.createdAt - b.createdAt,
  )

  return {
    toDelete: matchedItems.slice(0, maxDelete),
    matched: matchedItems.length,
    processedCandidates: processedCandidates.length,
    deadLetterCandidates: deadLetterCandidates.length,
  }
}

export const Route = createFileRoute("/api/github/webhook-queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const unauthorized = requireWebhookOpsAuth(request)
          if (unauthorized) return unauthorized

          log.info("Webhook queue API: listing failed/dead-letter items", {
            op: "webhook-queue-get",
            entity: "webhookQueue",
          })
          const { webhookQueue } = await adminDb.query({
            webhookQueue: {
              $: {
                where: {
                  or: [{ status: "dead_letter" }, { status: "failed" }],
                },
                order: { createdAt: "desc" },
              },
            },
          })

          const items = (webhookQueue || []).map((item) => ({
            id: item.id,
            deliveryId: item.deliveryId,
            event: item.event,
            action: item.action,
            status: item.status,
            attempts: item.attempts,
            maxAttempts: item.maxAttempts,
            lastError: item.lastError,
            createdAt: item.createdAt,
            failedAt: item.failedAt,
          }))

          return jsonResponse({ items })
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Unknown error" },
            500,
          )
        }
      },

      POST: async ({ request }) => {
        try {
          const unauthorized = requireWebhookOpsAuth(request)
          if (unauthorized) return unauthorized

          const body = (await request.json()) as {
            action: string
            itemId?: string
            dryRun?: boolean
            maxDelete?: number
          }

          if (body.action === "retry" && body.itemId) {
            log.info("Webhook queue API: retrying single item", {
              op: "webhook-queue-retry",
              entity: "webhookQueue",
              itemId: body.itemId,
              dataToUpdate: "webhookQueue.status=pending, attempts=0",
            })
            const now = Date.now()
            await adminDb.transact(
              adminDb.tx.webhookQueue[body.itemId].update({
                status: "pending",
                attempts: 0,
                nextRetryAt: now,
                lastError: undefined,
                failedAt: undefined,
                updatedAt: now,
              }),
            )
            return jsonResponse({ ok: true })
          }

          if (body.action === "discard" && body.itemId) {
            log.info("Webhook queue API: discarding single item", {
              op: "webhook-queue-discard",
              entity: "webhookQueue",
              itemId: body.itemId,
              dataToUpdate: "webhookQueue (delete)",
            })
            await adminDb.transact(adminDb.tx.webhookQueue[body.itemId].delete())
            return jsonResponse({ ok: true })
          }

          if (body.action === "retry-all") {
            log.info("Webhook queue API: retrying all dead-letter items", {
              op: "webhook-queue-retry-all",
              entity: "webhookQueue",
              dataToUpdate: "webhookQueue.status=pending, attempts=0 for all dead_letter",
            })
            const { webhookQueue } = await adminDb.query({
              webhookQueue: {
                $: { where: { status: "dead_letter" } },
              },
            })
            const now = Date.now()
            const txs = (webhookQueue || []).map((item) =>
              adminDb.tx.webhookQueue[item.id].update({
                status: "pending",
                attempts: 0,
                nextRetryAt: now,
                lastError: undefined,
                failedAt: undefined,
                updatedAt: now,
              }),
            )
            if (txs.length > 0) await adminDb.transact(txs)
            return jsonResponse({ ok: true, count: txs.length })
          }

          if (body.action === "discard-all") {
            log.info("Webhook queue API: discarding all dead-letter items", {
              op: "webhook-queue-discard-all",
              entity: "webhookQueue",
              dataToUpdate: "webhookQueue (delete all dead_letter)",
            })
            const { webhookQueue } = await adminDb.query({
              webhookQueue: {
                $: { where: { status: "dead_letter" } },
              },
            })
            const txs = (webhookQueue || []).map((item) =>
              adminDb.tx.webhookQueue[item.id].delete(),
            )
            if (txs.length > 0) await adminDb.transact(txs)
            return jsonResponse({ ok: true, count: txs.length })
          }

          if (body.action === "cleanup") {
            const now = Date.now()
            const dryRun = Boolean(body.dryRun)
            const requestedMaxDelete =
              typeof body.maxDelete === "number" && body.maxDelete > 0
                ? Math.floor(body.maxDelete)
                : WEBHOOK_CLEANUP_MAX_DELETE
            const maxDelete = Math.min(requestedMaxDelete, WEBHOOK_CLEANUP_MAX_DELETE)

            const { webhookQueue } = await adminDb.query({
              webhookQueue: {
                $: {
                  where: {
                    or: [{ status: "processed" }, { status: "dead_letter" }],
                  },
                  order: { createdAt: "asc" },
                },
              },
            })

            const cleanupPlan = selectWebhookQueueCleanupCandidates(
              (webhookQueue || []) as QueueCleanupItem[],
              now,
              maxDelete,
            )

            log.info("Webhook queue API: cleanup run", {
              op: "webhook-queue-cleanup",
              dryRun,
              maxDelete,
              matched: cleanupPlan.matched,
              deleteCount: cleanupPlan.toDelete.length,
              processedCandidates: cleanupPlan.processedCandidates,
              deadLetterCandidates: cleanupPlan.deadLetterCandidates,
            })

            if (!dryRun && cleanupPlan.toDelete.length > 0) {
              await adminDb.transact(
                cleanupPlan.toDelete.map((item) => adminDb.tx.webhookQueue[item.id].delete()),
              )
            }

            return jsonResponse({
              ok: true,
              dryRun,
              maxDelete,
              matched: cleanupPlan.matched,
              deleted: dryRun ? 0 : cleanupPlan.toDelete.length,
              wouldDelete: dryRun ? cleanupPlan.toDelete.length : 0,
              processedRetentionDays: 7,
              deadLetterRetentionDays: 30,
              processedCandidates: cleanupPlan.processedCandidates,
              deadLetterCandidates: cleanupPlan.deadLetterCandidates,
            })
          }

          return jsonResponse({ error: "Invalid action" }, 400)
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Unknown error" },
            500,
          )
        }
      },
    },
  },
})
