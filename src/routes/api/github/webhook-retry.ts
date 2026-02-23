import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import {
  handlePullRequestWebhook,
  handlePullRequestReviewWebhook,
  handleCommentWebhook,
  handlePushWebhook,
  handleRepositoryWebhook,
  handleStarWebhook,
  handleForkWebhook,
  handleOrganizationWebhook,
  handleCreateWebhook,
  handleDeleteWebhook,
  handlePullRequestEventWebhook,
  handleIssueWebhook,
  handleIssueCommentWebhook,
} from "@/lib/webhooks"
import type { WebhookEventName } from "@/lib/webhooks"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const getAction = (payload: Record<string, unknown>): string =>
  (payload.action as string) || "unknown"

async function processWebhookPayload(
  event: WebhookEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (event) {
    case "push":
      await handlePushWebhook(adminDb, payload)
      break
    case "create":
      await handleCreateWebhook(adminDb, payload)
      break
    case "delete":
      await handleDeleteWebhook(adminDb, payload)
      break
    case "fork":
      await handleForkWebhook(adminDb, payload)
      break
    case "repository":
      await handleRepositoryWebhook(adminDb, payload)
      break
    case "pull_request":
      await handlePullRequestWebhook(adminDb, payload)
      await handlePullRequestEventWebhook(adminDb, payload)
      break
    case "pull_request_review":
      await handlePullRequestReviewWebhook(adminDb, payload)
      break
    case "pull_request_review_comment":
      await handleCommentWebhook(adminDb, payload, event)
      break
    case "issues":
      await handleIssueWebhook(adminDb, payload)
      break
    case "issue_comment": {
      const issue = payload.issue as Record<string, unknown> | undefined
      if (issue?.pull_request) {
        await handleCommentWebhook(adminDb, payload, event)
      } else {
        await handleIssueCommentWebhook(adminDb, payload)
      }
      break
    }
    case "star":
      await handleStarWebhook(adminDb, payload)
      break
    case "organization":
      await handleOrganizationWebhook(adminDb, payload)
      break
    default:
      console.log(`Webhook retry: unhandled event type ${event}, action: ${getAction(payload)}`)
  }
}

export const Route = createFileRoute("/api/github/webhook-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { webhookDeliveries: failed } = await adminDb.query({
          webhookDeliveries: {
            $: { where: { status: "failed" } },
          },
        })

        if (!failed?.length) {
          return jsonResponse({ retried: 0, message: "No failed deliveries to retry" })
        }

        let retried = 0
        let succeeded = 0
        let stillFailed = 0

        for (const delivery of failed) {
          if (!delivery.payload) continue
          retried++

          try {
            const payload = JSON.parse(delivery.payload) as Record<string, unknown>
            await processWebhookPayload(delivery.event as WebhookEventName, payload)

            await adminDb.transact(
              adminDb.tx.webhookDeliveries[delivery.id].update({
                status: "processed",
                error: undefined,
                payload: undefined,
                processedAt: Date.now(),
              }),
            )
            succeeded++
          } catch (error) {
            stillFailed++
            await adminDb.transact(
              adminDb.tx.webhookDeliveries[delivery.id].update({
                error: error instanceof Error ? error.message : "Retry failed",
                processedAt: Date.now(),
              }),
            )
          }
        }

        return jsonResponse({ retried, succeeded, stillFailed })
      },
    },
  },
})
