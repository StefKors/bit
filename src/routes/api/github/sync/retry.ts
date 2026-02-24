import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod/v4"
import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"
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
import type { IssueCommentEvent, WebhookEventName, WebhookPayload } from "@/lib/webhooks"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const retryRequestBodySchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
})

const isIssueCommentPayload = (payload: WebhookPayload): payload is IssueCommentEvent =>
  typeof payload === "object" && payload !== null && "issue" in payload && "comment" in payload

async function processWebhookPayload(
  event: WebhookEventName,
  payload: WebhookPayload,
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
      if (isIssueCommentPayload(payload) && payload.issue.pull_request) {
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
  }
}

export const Route = createFileRoute("/api/github/sync/retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "")

        if (!userId) {
          return jsonResponse({ error: "Not authenticated" }, 401)
        }

        try {
          const bodyResult = retryRequestBodySchema.safeParse(await request.json())
          if (!bodyResult.success) {
            return jsonResponse({ error: "resourceType is required" }, 400)
          }
          const { resourceType, resourceId } = bodyResult.data

          const client = await createGitHubClient(userId)
          if (!client) {
            return jsonResponse({ error: "GitHub account not connected" }, 400)
          }

          let result
          switch (resourceType) {
            case "overview":
            case "orgs":
              result = await client.fetchOrganizations()
              return jsonResponse({
                success: true,
                rateLimit: result.rateLimit,
                data: result.data,
              })
            case "repos":
              result = await client.fetchRepositories()
              return jsonResponse({
                success: true,
                rateLimit: result.rateLimit,
                data: result.data,
              })
            case "pulls":
              if (resourceId) {
                const [owner, repo] = resourceId.split("/")
                result = await client.fetchPullRequests(owner, repo, "open")
                return jsonResponse({
                  success: true,
                  rateLimit: result.rateLimit,
                  data: result.data,
                })
              } else {
                return jsonResponse({ error: "resourceId required for pull requests" }, 400)
              }
            case "initial_sync":
              result = await client.performInitialSync()
              return jsonResponse({
                success: true,
                result,
              })
            case "webhooks": {
              log.info("Retry API: fetching failed webhook deliveries", {
                op: "retry-webhooks",
                resourceType: "webhooks",
                entity: "webhookDeliveries",
              })
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
                log.info("Retry API: processing failed webhook delivery", {
                  op: "retry-webhooks",
                  deliveryId: delivery.deliveryId,
                  event: delivery.event,
                  action: delivery.action,
                  entity: "webhookDeliveries",
                  dataToUpdate: "webhookDeliveries.status, webhook handlers (repos, prs, etc.)",
                })
                try {
                  const payload = JSON.parse(delivery.payload) as WebhookPayload
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
                } catch (retryError) {
                  stillFailed++
                  await adminDb.transact(
                    adminDb.tx.webhookDeliveries[delivery.id].update({
                      error:
                        retryError instanceof Error
                          ? retryError.message
                          : "Retry failed with non-Error value",
                      processedAt: Date.now(),
                    }),
                  )
                }
              }

              log.info("Retry API: webhook retry complete", {
                op: "retry-webhooks",
                retried,
                succeeded,
                stillFailed,
              })
              return jsonResponse({ retried, succeeded, stillFailed })
            }
            default:
              return jsonResponse({ error: "Unsupported resource type" }, 400)
          }
        } catch (error) {
          console.error("Error retrying sync:", error)

          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              {
                error: "GitHub authentication expired",
                code: "auth_invalid",
                details:
                  "Your GitHub token is no longer valid. Please reconnect your GitHub account.",
              },
              401,
            )
          }

          return jsonResponse(
            {
              error: "Internal server error",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
