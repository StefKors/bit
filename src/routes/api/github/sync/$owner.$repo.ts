import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { auth } from "../../auth/-auth"
import { createGitHubClient } from "../-client"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/$owner/$repo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo } = params
        const url = new URL(request.url)
        const state = (url.searchParams.get("state") as "open" | "closed" | "all") || "all"

        const client = await createGitHubClient(session.user.id, pool)
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
          return jsonResponse(
            {
              error: "Failed to sync pull requests",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500
          )
        }
      },
    },
  },
})


