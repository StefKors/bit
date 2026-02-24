import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"
import { RequestError } from "octokit"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const updatePullRequestSchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.title === undefined && value.body === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of title or body is required",
      })
    }
  })

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

const updateLocalPullRequest = async (params: {
  owner: string
  repo: string
  pullNumber: number
  userId: string
  title?: string
  body?: string
  state?: "open" | "closed"
  draft?: boolean
  githubUpdatedAt?: number | null
}) => {
  const fullName = `${params.owner}/${params.repo}`
  const { repos } = await adminDb.query({
    repos: {
      $: {
        where: { fullName, userId: params.userId },
        limit: 1,
      },
    },
  })
  const repoRecord = repos?.[0]
  if (!repoRecord) return

  const { pullRequests } = await adminDb.query({
    pullRequests: {
      $: {
        where: {
          number: params.pullNumber,
          repoId: repoRecord.id,
        },
        limit: 1,
      },
    },
  })
  const pr = pullRequests?.[0]
  if (!pr) return

  const existingTitle = typeof pr.title === "string" ? pr.title : ""
  const existingBody = typeof pr.body === "string" ? pr.body : undefined

  await adminDb.transact(
    adminDb.tx.pullRequests[pr.id].update({
      title: params.title ?? existingTitle,
      body: params.body ?? existingBody,
      state: params.state ?? pr.state,
      draft: params.draft ?? pr.draft,
      githubUpdatedAt: params.githubUpdatedAt ?? pr.githubUpdatedAt,
      updatedAt: Date.now(),
    }),
  )
}

export const Route = createFileRoute("/api/github/pr/update/$owner/$repo/$number")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
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

        const parsed = updatePullRequestSchema.safeParse(body)
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result = await client.updatePullRequest(owner, repo, pullNumber, {
            title: parsed.data.title,
            body: parsed.data.body,
          })

          await updateLocalPullRequest({
            owner,
            repo,
            pullNumber,
            userId,
            title: result.title,
            body: result.body ?? undefined,
            state: result.state,
            draft: result.draft,
            githubUpdatedAt: result.githubUpdatedAt,
          })

          return jsonResponse(result)
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
                { error: error.message || "Unable to update pull request", code: "unprocessable" },
                422,
              )
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }
          log.error("Unexpected pull request update error", error, {
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
