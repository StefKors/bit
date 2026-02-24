import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { log } from "@/lib/logger"
import { RequestError } from "octokit"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const reviewEventSchema = z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"])

const submitReviewSchema = z.object({
  action: z.literal("submit").optional(),
  event: reviewEventSchema,
  body: z.string().optional(),
})

const createDraftSchema = z.object({
  action: z.literal("create_draft"),
  body: z.string().optional(),
})

const submitDraftSchema = z.object({
  action: z.literal("submit_draft"),
  reviewId: z.number().int().positive(),
  event: reviewEventSchema,
  body: z.string().optional(),
})

const discardDraftSchema = z.object({
  action: z.literal("discard_draft"),
  reviewId: z.number().int().positive(),
})

const reRequestReviewSchema = z.object({
  action: z.literal("re_request"),
  reviewers: z.array(z.string().min(1)).min(1),
  teamReviewers: z.array(z.string().min(1)).optional(),
})

const reviewSchema = z.union([
  submitReviewSchema,
  createDraftSchema,
  submitDraftSchema,
  discardDraftSchema,
  reRequestReviewSchema,
])

const legacySubmitSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  body: z.string().optional(),
})

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

export const Route = createFileRoute("/api/github/reviews/$owner/$repo/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)

        const pullNumber = parseInt((params as { number: string }).number, 10)
        if (Number.isNaN(pullNumber))
          return jsonResponse({ error: "Invalid pull request number" }, 400)

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parsed = reviewSchema.safeParse(body)
        const legacyParsed = !parsed.success ? legacySubmitSchema.safeParse(body) : null
        const normalizedReviewInput =
          parsed.success || !legacyParsed?.success
            ? parsed
            : reviewSchema.safeParse({
                action: "submit",
                event: legacyParsed.data.event,
                body: legacyParsed.data.body,
              })

        if (!normalizedReviewInput.success)
          return jsonResponse(
            { error: "Invalid request body", details: normalizedReviewInput.error.issues },
            400,
          )

        const input = normalizedReviewInput.data
        if (!parsed.success && legacyParsed?.success) {
          log.info("Legacy review submit payload used without action field", {
            owner: (params as { owner: string }).owner,
            repo: (params as { repo: string }).repo,
            pullNumber,
          })
        }

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          if (input.action === "create_draft") {
            const result = await client.createPullRequestReview(owner, repo, pullNumber, {
              draft: true,
              body: input.body,
            })
            return jsonResponse(result, 201)
          }

          if (input.action === "submit_draft") {
            const result = await client.submitPullRequestReview(
              owner,
              repo,
              pullNumber,
              input.reviewId,
              {
                event: input.event,
                body: input.body,
              },
            )
            return jsonResponse(result)
          }

          if (input.action === "discard_draft") {
            const result = await client.discardPendingReview(
              owner,
              repo,
              pullNumber,
              input.reviewId,
            )
            return jsonResponse(result)
          }

          if (input.action === "re_request") {
            const result = await client.requestReviewers(owner, repo, pullNumber, {
              reviewers: input.reviewers,
              teamReviewers: input.teamReviewers,
            })
            return jsonResponse(result)
          }

          const result = await client.createPullRequestReview(owner, repo, pullNumber, {
            event: input.event,
            body: input.body,
          })
          return jsonResponse(result, 201)
        } catch (error) {
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              { error: "GitHub authentication expired", code: "auth_invalid" },
              401,
            )
          }
          if (error instanceof RequestError) {
            if (error.status === 404)
              return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)
            if (error.status === 422)
              return jsonResponse(
                { error: error.message || "Unable to submit review", code: "unprocessable" },
                422,
              )
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }
          log.error("Unexpected review submission error", error, {
            owner,
            repo,
            pullNumber,
            userId,
          })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },
    },
  },
})
