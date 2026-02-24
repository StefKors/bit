import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"

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
            await adminDb.transact(adminDb.tx.webhookQueue[body.itemId].delete())
            return jsonResponse({ ok: true })
          }

          if (body.action === "retry-all") {
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
