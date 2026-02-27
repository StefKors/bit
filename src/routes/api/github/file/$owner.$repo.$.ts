import { createFileRoute } from "@tanstack/react-router"
import { Octokit } from "octokit"
import { adminDb } from "@/lib/instantAdmin"
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
        // Get user from request headers
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo, _splat: path } = params
        const url = new URL(request.url)
        const ref = url.searchParams.get("ref") || "main"

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
          const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: path || "",
            ref,
          })

          // Handle file content (not directory)
          if (Array.isArray(response.data)) {
            return jsonResponse({ error: "Path is a directory, not a file" }, 400)
          }

          if (response.data.type !== "file") {
            return jsonResponse({ error: "Path is not a file" }, 400)
          }

          // Decode base64 content
          const content = response.data.content
            ? Buffer.from(response.data.content, "base64").toString("utf-8")
            : null

          return jsonResponse({
            content,
            sha: response.data.sha,
            size: response.data.size,
            name: response.data.name,
            path: response.data.path,
          })
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
