import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/webhook-queue")({
  server: {
    handlers: {
      GET: async () => {
        try {
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
          const body = (await request.json()) as { action: string; itemId?: string }

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
