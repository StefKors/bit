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

const createReviewCommentSchema = z
  .object({
    body: z.string().min(1),
    path: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    side: z.enum(["LEFT", "RIGHT"]).optional(),
    commitId: z.string().min(1).optional(),
    inReplyTo: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.inReplyTo) return
    if (!value.path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "path is required when creating a top-level inline comment",
        path: ["path"],
      })
    }
    if (!value.line) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "line is required when creating a top-level inline comment",
        path: ["line"],
      })
    }
    if (!value.side) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "side is required when creating a top-level inline comment",
        path: ["side"],
      })
    }
    if (!value.commitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "commitId is required when creating a top-level inline comment",
        path: ["commitId"],
      })
    }
  })

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

export const Route = createFileRoute("/api/github/review-comments/$owner/$repo/$number")({
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

        const parsed = createReviewCommentSchema.safeParse(body)
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result = await client.createReviewComment(owner, repo, pullNumber, parsed.data)
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
                { error: error.message || "Invalid inline comment target", code: "unprocessable" },
                422,
              )
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }
          log.error("Unexpected inline review comment error", error, {
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
