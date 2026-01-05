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

export const Route = createFileRoute("/api/github/sync/overview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(session.user.id, pool)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          // Fetch organizations
          const orgsResult = await client.fetchOrganizations()

          // Fetch repositories
          const reposResult = await client.fetchRepositories()

          return jsonResponse({
            organizations: orgsResult.data.length,
            repositories: reposResult.data.length,
            rateLimit: reposResult.rateLimit,
          })
        } catch (error) {
          console.error("Error syncing overview:", error)
          return jsonResponse(
            {
              error: "Failed to sync overview",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500
          )
        }
      },
    },
  },
})


