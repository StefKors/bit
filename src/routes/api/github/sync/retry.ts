import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            resourceType: string
            resourceId?: string
          }
          const { resourceType, resourceId } = body

          if (!resourceType) {
            return jsonResponse({ error: "resourceType is required" }, 400)
          }

          // Get current user from Authorization header
          const authHeader = request.headers.get("Authorization")
          const userId = authHeader?.replace("Bearer ", "")

          if (!userId) {
            return jsonResponse({ error: "Not authenticated" }, 401)
          }

          const client = await createGitHubClient(userId)
          if (!client) {
            return jsonResponse({ error: "GitHub account not connected" }, 400)
          }

          let result
          switch (resourceType) {
            case "overview":
            case "orgs":
              result = await client.fetchOrganizations()
              return jsonResponse({
                success: true,
                rateLimit: result.rateLimit,
                data: result.data,
              })
            case "repos":
              result = await client.fetchRepositories()
              return jsonResponse({
                success: true,
                rateLimit: result.rateLimit,
                data: result.data,
              })
            case "pulls":
              if (resourceId) {
                const [owner, repo] = resourceId.split("/")
                result = await client.fetchPullRequests(owner, repo, "open")
                return jsonResponse({
                  success: true,
                  rateLimit: result.rateLimit,
                  data: result.data,
                })
              } else {
                return jsonResponse({ error: "resourceId required for pull requests" }, 400)
              }
            case "initial_sync":
              result = await client.performInitialSync()
              return jsonResponse({
                success: true,
                result,
              })
            default:
              return jsonResponse({ error: "Unsupported resource type" }, 400)
          }
        } catch (error) {
          console.error("Error retrying sync:", error)
          return jsonResponse(
            {
              error: "Internal server error",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
