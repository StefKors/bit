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

const draftActionSchema = z.object({
  action: z.enum(["convert_to_draft", "ready_for_review"]),
})

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

const updateLocalDraftState = async (params: {
  owner: string
  repo: string
  pullNumber: number
  userId: string
  draft: boolean
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

  await adminDb.transact(
    adminDb.tx.pullRequests[pr.id].update({
      draft: params.draft,
      updatedAt: Date.now(),
    }),
  )
}

export const Route = createFileRoute("/api/github/pr/draft/$owner/$repo/$number")({
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

        const parsed = draftActionSchema.safeParse(body)
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result =
            parsed.data.action === "convert_to_draft"
              ? await client.convertPullRequestToDraft(owner, repo, pullNumber)
              : await client.markPullRequestReadyForReview(owner, repo, pullNumber)

          await updateLocalDraftState({
            owner,
            repo,
            pullNumber,
            userId,
            draft: result.draft,
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
                { error: error.message || "Unable to update draft state", code: "unprocessable" },
                422,
              )
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }
          log.error("Unexpected draft state update error", error, {
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
