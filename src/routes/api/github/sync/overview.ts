import { createFileRoute } from "@tanstack/react-router"
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
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        // Kick off the full sync in the background (fire-and-forget)
        // Don't await - let it run asynchronously
        client.performInitialSync().catch((error) => {
          console.error("Background sync error:", error)
        })

        // Return immediately so the UI can show progress
        return jsonResponse({
          status: "started",
          message: "Sync started in background",
        })
      },
    },
  },
})
