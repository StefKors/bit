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

export const Route = createFileRoute("/api/github/rate-limit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(session.user.id, pool)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const rateLimit = await client.getRateLimit()
          return jsonResponse({ rateLimit })
        } catch (error) {
          console.error("Error fetching rate limit:", error)
          return jsonResponse({ error: "Failed to fetch rate limit" }, 500)
        }
      },
    },
  },
})


