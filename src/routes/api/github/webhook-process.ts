import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { processPendingQueue } from "@/lib/webhooks/processor"
import { log } from "@/lib/logger"
import { requireWebhookOpsAuth } from "@/lib/webhooks/ops-auth"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/webhook-process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const unauthorized = requireWebhookOpsAuth(request)
          if (unauthorized) return unauthorized

          const result = await processPendingQueue(adminDb)
          log.info("Webhook process: queue processing complete", {
            op: "webhook-process",
            entity: "webhookQueue",
            ...result,
          })
          return jsonResponse(result)
        } catch (error) {
          log.error("Queue processing failed", error)
          return jsonResponse({ error: "Queue processing failed" }, 500)
        }
      },
    },
  },
})
