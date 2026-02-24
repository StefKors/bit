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

const stateRequestSchema = z.object({
  state: z.enum(["open", "closed"]),
})

export const Route = createFileRoute("/api/github/pr/state/$owner/$repo/$number")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)
        }

        const { owner, repo, number } = params as { owner: string; repo: string; number: string }
        const pullNumber = parseInt(number, 10)

        if (Number.isNaN(pullNumber)) {
          return jsonResponse({ error: "Invalid pull request number" }, 400)
        }

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parseResult = stateRequestSchema.safeParse(body)
        if (!parseResult.success) {
          return jsonResponse(
            {
              error: "Invalid request body",
              details: parseResult.error.issues,
            },
            400,
          )
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)
        }

        try {
          const result = await client.updatePullRequestState(
            owner,
            repo,
            pullNumber,
            parseResult.data.state,
          )

          const fullName = `${owner}/${repo}`
          const { repos } = await adminDb.query({
            repos: {
              $: { where: { fullName } },
            },
          })

          const repoRecord = repos?.[0]
          if (repoRecord) {
            const { pullRequests } = await adminDb.query({
              pullRequests: {
                $: { where: { number: pullNumber, repoId: repoRecord.id } },
              },
            })

            const pr = pullRequests?.[0]
            if (pr) {
              const now = Date.now()
              await adminDb.transact(
                adminDb.tx.pullRequests[pr.id].update({
                  state: result.state,
                  merged: false,
                  closedAt: result.state === "closed" ? now : undefined,
                  updatedAt: now,
                }),
              )
            }
          }

          log.info("PR state updated", {
            owner,
            repo,
            pullNumber,
            state: result.state,
            userId,
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
            if (error.status === 404) {
              return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)
            }

            if (error.status === 422) {
              return jsonResponse(
                {
                  error: error.message || "Unable to update pull request state",
                  code: "unprocessable",
                },
                422,
              )
            }

            log.error("GitHub API error updating PR state", error, {
              owner,
              repo,
              pullNumber,
              userId,
              status: error.status,
            })

            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }

          log.error("Unexpected error updating PR state", error, {
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
