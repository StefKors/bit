import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/$owner/$repo/pull/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Get user from request headers
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo, number } = params
        const pullNumber = parseInt(number, 10)

        if (isNaN(pullNumber)) {
          return jsonResponse({ error: "Invalid pull request number" }, 400)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.fetchPullRequestDetails(owner, repo, pullNumber)

          return jsonResponse({
            prId: result.prId,
            rateLimit: result.rateLimit,
          })
        } catch (error) {
          console.error("Error syncing PR details:", error)
          return jsonResponse(
            {
              error: "Failed to sync PR details",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
