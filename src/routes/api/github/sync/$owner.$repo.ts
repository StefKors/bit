import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/$owner/$repo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Get user from request headers
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo } = params
        const url = new URL(request.url)
        const state = (url.searchParams.get("state") as "open" | "closed" | "all") || "all"

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.fetchPullRequests(owner, repo, state)

          return jsonResponse({
            pullRequests: result.data.length,
            rateLimit: result.rateLimit,
          })
        } catch (error) {
          console.error("Error syncing pull requests:", error)

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

          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status
            if (status === 404) {
              return jsonResponse(
                {
                  error: "Repository not found",
                  details: `Could not find ${owner}/${repo}. It may not exist, be private, or your GitHub token may not have access.`,
                },
                404,
              )
            }
            if (status === 403) {
              return jsonResponse(
                {
                  error: "Access denied",
                  details:
                    "Rate limit exceeded or insufficient permissions to access this repository.",
                },
                403,
              )
            }
          }

          return jsonResponse(
            {
              error: "Failed to sync pull requests",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
