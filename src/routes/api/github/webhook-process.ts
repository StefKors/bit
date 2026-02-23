import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { processPendingQueue } from "@/lib/webhooks/processor"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/webhook-process")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processPendingQueue(adminDb)
          log.info("Queue processing complete", result)
          return jsonResponse(result)
        } catch (error) {
          log.error("Queue processing failed", error)
          return jsonResponse({ error: "Queue processing failed" }, 500)
        }
      },
    },
  },
})
