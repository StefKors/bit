import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/repos/available")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.fetchAvailableRepoNames()
          const repos = [...result.data].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" }),
          )
          return jsonResponse({ repos })
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            error.status === 403
          ) {
            return jsonResponse(
              {
                error:
                  "GitHub App does not have repository access for this installation. Reconfigure installation repository access in GitHub.",
              },
              403,
            )
          }
          log.error("Failed to fetch available repositories", error, {
            op: "available-repos",
            userId,
          })
          return jsonResponse({ error: "Failed to fetch available repositories" }, 500)
        }
      },
    },
  },
})
