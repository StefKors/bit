import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/rate-limit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Get user from request headers
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
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
