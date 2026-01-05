import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { createHmac, timingSafeEqual } from "crypto"
import { drizzle } from "drizzle-orm/node-postgres"
import * as dbSchema from "../../../../schema"
import {
  handlePullRequestWebhook,
  handlePullRequestReviewWebhook,
  handleCommentWebhook,
} from "@/lib/webhooks"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

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
          console.error("GITHUB_WEBHOOK_SECRET not configured")
          return jsonResponse({ error: "Webhook not configured" }, 500)
        }

        // Get raw body for signature verification
        const rawBody = await request.text()
        const signature = request.headers.get("x-hub-signature-256") || ""

        // Verify signature
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          console.error("Invalid webhook signature")
          return jsonResponse({ error: "Invalid signature" }, 401)
        }

        const event = request.headers.get("x-github-event")
        const delivery = request.headers.get("x-github-delivery")

        console.log(`Received GitHub webhook: ${event} (${delivery})`)

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400)
        }

        const db = drizzle(pool, { schema: dbSchema })

        try {
          switch (event) {
            case "pull_request": {
              await handlePullRequestWebhook(db, payload)
              break
            }
            case "pull_request_review": {
              await handlePullRequestReviewWebhook(db, payload)
              break
            }
            case "pull_request_review_comment":
            case "issue_comment": {
              await handleCommentWebhook(db, payload, event)
              break
            }
            case "ping": {
              console.log("Received ping webhook")
              break
            }
            default: {
              console.log(`Unhandled webhook event: ${event}`)
            }
          }

          return jsonResponse({ received: true })
        } catch (error) {
          console.error("Error processing webhook:", error)
          return jsonResponse({ error: "Failed to process webhook" }, 500)
        }
      },
    },
  },
})
