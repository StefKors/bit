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

const reviewSchema = z.object({
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
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result = await client.createPullRequestReview(owner, repo, pullNumber, {
            event: parsed.data.event,
            body: parsed.data.body,
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
