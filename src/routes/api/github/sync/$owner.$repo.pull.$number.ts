import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { auth } from "@/lib/auth-server"
import { createGitHubClient } from "@/lib/github-client"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/$owner/$repo/pull/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo, number } = params
        const pullNumber = parseInt(number, 10)

        if (isNaN(pullNumber)) {
          return jsonResponse({ error: "Invalid pull request number" }, 400)
        }

        const client = await createGitHubClient(session.user.id, pool)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.fetchPullRequestDetails(owner, repo, pullNumber)

          return jsonResponse({
            files: result.files.length,
            reviews: result.reviews.length,
            comments: result.comments.length,
            commits: result.commits.length,
            events: result.events.length,
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
