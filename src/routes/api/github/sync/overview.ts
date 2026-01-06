import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { createGitHubClient } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/overview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Get user from InstantDB auth
        // For now, we'll extract the user from request headers or session
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
            500,
          )
        }
      },
    },
  },
})
