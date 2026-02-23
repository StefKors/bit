import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"
import { checkPermissions } from "@/lib/github-permissions"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/permissions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
          const grantedScopes = await client.getTokenScopes()
          const report = checkPermissions(grantedScopes)

          if (!report.allGranted) {
            log.warn("GitHub token missing required scopes", {
              userId,
              missing: report.missingScopes.join(", "),
              granted: report.grantedScopes.join(", ") || "(none)",
            })
          }

          return jsonResponse(report)
        } catch (error) {
          log.error("Failed to check GitHub permissions", error, { userId })
          return jsonResponse(
            {
              error: "Failed to check permissions",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
