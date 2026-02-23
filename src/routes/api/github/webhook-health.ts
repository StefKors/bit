import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/webhook-health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const now = Date.now()

          const [pending, processing, failed, deadLetter, processed] = await Promise.all([
            adminDb.query({
              webhookQueue: { $: { where: { status: "pending" } } },
            }),
            adminDb.query({
              webhookQueue: { $: { where: { status: "processing" } } },
            }),
            adminDb.query({
              webhookQueue: { $: { where: { status: "failed" } } },
            }),
            adminDb.query({
              webhookQueue: { $: { where: { status: "dead_letter" } } },
            }),
            adminDb.query({
              webhookQueue: {
                $: {
                  where: { status: "processed" },
                  limit: 1,
                },
              },
            }),
          ])

          const pendingItems = pending.webhookQueue || []
          const processingItems = processing.webhookQueue || []
          const failedItems = failed.webhookQueue || []
          const deadLetterItems = deadLetter.webhookQueue || []
          const lastProcessed = processed.webhookQueue?.[0]

          const oldestPending = pendingItems.reduce(
            (oldest, item) => (item.createdAt < oldest ? item.createdAt : oldest),
            Infinity,
          )

          return jsonResponse({
            status: "ok",
            queue: {
              pending: pendingItems.length,
              processing: processingItems.length,
              failed: failedItems.length,
              deadLetter: deadLetterItems.length,
              oldestPendingAgeMs: oldestPending === Infinity ? 0 : now - oldestPending,
              lastProcessedAt: lastProcessed?.processedAt ?? null,
            },
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
