import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/webhooks")({
  server: {
    handlers: {
      // POST: Register webhooks for all repos
      POST: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.registerAllWebhooks()

          return jsonResponse({
            success: true,
            total: result.total,
            installed: result.installed,
            noAccess: result.noAccess,
            errors: result.errors,
            results: result.results,
          })
        } catch (err) {
          console.error("Error registering webhooks:", err)
          return jsonResponse(
            { error: err instanceof Error ? err.message : "Failed to register webhooks" },
            500,
          )
        }
      },
    },
  },
})
