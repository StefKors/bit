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

          const { webhookQueue: allItems } = await adminDb.query({
            webhookQueue: {},
          })
          const items = allItems || []

          const pendingItems = items.filter((i) => i.status === "pending")
          const processingItems = items.filter((i) => i.status === "processing")
          const failedItems = items.filter((i) => i.status === "failed")
          const deadLetterItems = items.filter((i) => i.status === "dead_letter")
          const lastProcessed = items
            .filter((i) => i.status === "processed")
            .sort((a, b) => (b.processedAt ?? 0) - (a.processedAt ?? 0))[0]

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
