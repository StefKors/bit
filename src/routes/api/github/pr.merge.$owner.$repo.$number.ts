import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"
import { RequestError } from "octokit"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const mergeRequestSchema = z.object({
  commitTitle: z.string().optional(),
  commitMessage: z.string().optional(),
  sha: z.string().optional(),
  mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge"),
})

export const Route = createFileRoute("/api/github/pr/merge/$owner/$repo/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Get user from request headers
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

        // Parse request body
        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parseResult = mergeRequestSchema.safeParse(body)
        if (!parseResult.success) {
          return jsonResponse(
            {
              error: "Invalid request body",
              details: parseResult.error.issues,
            },
            400,
          )
        }

        const options = parseResult.data

        // Get GitHub client
        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse(
            {
              error: "GitHub connection not found",
              code: "auth_invalid",
            },
            401,
          )
        }

        try {
          const result = await client.mergePullRequest(owner, repo, pullNumber, options)

          if (result.merged) {
            // Update PR state in database
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
                    merged: true,
                    state: "closed",
                    mergedAt: now,
                    updatedAt: now,
                  }),
                )
              }
            }

            log.info("PR merged successfully", {
              owner,
              repo,
              pullNumber,
              userId,
              mergeMethod: options.mergeMethod,
              sha: result.sha,
            })
          }

          return jsonResponse(result)
        } catch (error) {
          // Handle GitHub auth errors
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              {
                error: "GitHub authentication expired",
                code: "auth_invalid",
              },
              401,
            )
          }

          if (error instanceof RequestError) {
            // Handle specific GitHub API errors
            if (error.status === 405) {
              return jsonResponse(
                {
                  error: "Merge conflict - PR cannot be merged automatically",
                  code: "merge_conflict",
                },
                409,
              )
            }

            if (error.status === 404) {
              return jsonResponse(
                {
                  error: "Pull request not found",
                  code: "not_found",
                },
                404,
              )
            }

            if (error.status === 422) {
              const errorMessage = error.message || "PR cannot be merged"
              return jsonResponse(
                {
                  error: errorMessage,
                  code: "unprocessable",
                },
                422,
              )
            }

            log.error("GitHub API error during merge", error, {
              owner,
              repo,
              pullNumber,
              userId,
              status: error.status,
            })

            return jsonResponse(
              {
                error: error.message || "GitHub API error",
                code: "github_error",
              },
              error.status || 500,
            )
          }

          log.error("Unexpected error during merge", error, {
            owner,
            repo,
            pullNumber,
            userId,
          })

          return jsonResponse(
            {
              error: "Internal server error",
              code: "internal_error",
            },
            500,
          )
        }
      },
    },
  },
})
