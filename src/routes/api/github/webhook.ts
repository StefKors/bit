import { createFileRoute } from "@tanstack/react-router"
import { createHmac, timingSafeEqual } from "crypto"
import { adminDb } from "@/lib/instantAdmin"
import { enqueueWebhook, triggerWebhookProcessor } from "@/lib/webhooks/processor"
import { validateWebhookPayload } from "@/lib/webhook-validation"
import { log } from "@/lib/logger"
import { logWebhookReceived, logWebhookEnqueued } from "@/lib/webhooks/logging"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  if (!signature) return false

  const sig = signature.replace("sha256=", "")
  const hmac = createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(digest))
  } catch {
    return false
  }
}

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

        if (!webhookSecret) {
          log.error("GITHUB_WEBHOOK_SECRET not configured", new Error("Missing config"))
          return jsonResponse({ error: "Webhook not configured" }, 500)
        }

        const rawBody = await request.text()
        const signature = request.headers.get("x-hub-signature-256") || ""

        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          log.warn("Invalid webhook signature")
          return jsonResponse({ error: "Invalid signature" }, 401)
        }

        const event = request.headers.get("x-github-event")
        const delivery = request.headers.get("x-github-delivery")

        if (!event) {
          return jsonResponse({ error: "Missing event header" }, 400)
        }

        let parsedPayload: object
        try {
          parsedPayload = JSON.parse(rawBody) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400)
        }

        const payloadValidation = validateWebhookPayload(parsedPayload)
        if (!payloadValidation.valid) {
          return jsonResponse({ error: "Invalid webhook payload shape" }, 400)
        }

        const action = payloadValidation.data.action || undefined
        logWebhookReceived(event, delivery, action, parsedPayload)

        if (!delivery) {
          return jsonResponse({ error: "Missing delivery ID" }, 400)
        }

        const result = await enqueueWebhook(adminDb, delivery, event, action, rawBody)

        if (result.duplicate) {
          log.info("Duplicate webhook delivery, skipping", {
            op: "webhook-duplicate",
            deliveryId: delivery,
            event,
            action,
          })
          return jsonResponse({ received: true, duplicate: true })
        }

        if (result.queueItemId) {
          logWebhookEnqueued(delivery, event, action, result.queueItemId)
        }

        triggerWebhookProcessor(adminDb)

        return jsonResponse({ received: true, queued: true, queueItemId: result.queueItemId })
      },
    },
  },
})
