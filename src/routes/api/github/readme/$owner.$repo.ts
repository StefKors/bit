import { createFileRoute } from "@tanstack/react-router"
import { Octokit } from "octokit"
import { adminDb } from "@/lib/instantAdmin"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/readme/$owner/$repo")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Get user from request headers
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo } = params
        const url = new URL(request.url)
        const ref = url.searchParams.get("ref") || undefined

        // Get user's GitHub token
        const { syncStates } = await adminDb.query({
          syncStates: {
            $: {
              where: {
                resourceType: "github:token",
                userId,
              },
            },
          },
        })

        const tokenState = syncStates?.[0]
        const accessToken = tokenState?.lastEtag

        if (!accessToken) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        const octokit = new Octokit({ auth: accessToken })

        try {
          const response = await octokit.rest.repos.getReadme({
            owner,
            repo,
            ref,
          })

          // Decode base64 content
          const content = response.data.content
            ? Buffer.from(response.data.content, "base64").toString("utf-8")
            : null

          return jsonResponse({
            content,
            name: response.data.name,
            path: response.data.path,
          })
        } catch (error) {
          // README not found is not really an error, just return null
          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status
            if (status === 404) {
              return jsonResponse({ content: null })
            }
          }

          console.error("Error fetching README:", error)
          return jsonResponse(
            {
              error: "Failed to fetch README",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
