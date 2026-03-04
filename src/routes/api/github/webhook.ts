import { createFileRoute } from "@tanstack/react-router"
import { createHmac, timingSafeEqual } from "crypto"
import { persistWebhookPayloadSafely } from "@/lib/webhook-persistence"
import { validateWebhookPayload } from "@/lib/webhook-validation"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string,
): boolean => {
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

export const handleWebhookPost = async ({
  request,
  persistWebhook = persistWebhookPayloadSafely,
}: {
  request: Request
  persistWebhook?: (params: { event: string; deliveryId: string; payload: object }) => Promise<void>
}): Promise<Response> => {
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
  } catch (parseError) {
    log.warn("Webhook received with malformed JSON payload", {
      event,
      delivery,
      error: parseError instanceof Error ? parseError.message : "JSON parse failed",
    })
    return jsonResponse({ error: "Invalid JSON payload" }, 400)
  }

  const payloadValidation = validateWebhookPayload(parsedPayload)
  if (!payloadValidation.valid) {
    return jsonResponse({ error: "Invalid webhook payload shape" }, 400)
  }

  const action = payloadValidation.data.action || undefined
  log.info("Webhook received", { event, delivery, action })

  if (delivery) {
    await persistWebhook({
      event,
      deliveryId: delivery,
      payload: parsedPayload,
    })
  }

  if (event === "ping") {
    log.info("Received ping webhook - webhook is configured correctly")
  }

  return jsonResponse({ received: true })
}

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWebhookPost({ request }),
    },
  },
})
