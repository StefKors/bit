import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/file/$owner/$repo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo, _splat: path } = params
        const url = new URL(request.url)
        const ref = url.searchParams.get("ref") || "main"

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const result = await client.getFileContent(owner, repo, path || "", ref)
          return jsonResponse(result)
        } catch (error) {
          log.error("Error fetching file", error, { op: "file", owner, repo, path })

          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status
            if (status === 404) {
              return jsonResponse(
                {
                  error: "File not found",
                  details: `Could not find ${path} in ${owner}/${repo}`,
                },
                404,
              )
            }
          }

          return jsonResponse(
            {
              error: "Failed to fetch file",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
