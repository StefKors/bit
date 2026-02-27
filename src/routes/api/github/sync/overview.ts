import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/overview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        client.performInitialSync().catch(async (error) => {
          log.error("Background sync error", error, { op: "sync-overview", userId })
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
          }
        })

        return jsonResponse({
          status: "started",
          message: "Sync started in background",
        })
      },
    },
  },
})
