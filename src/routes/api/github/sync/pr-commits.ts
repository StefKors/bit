import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/InstantAdmin"
import { getInstallationIdForUser } from "@/lib/GithubApp"
import { fetchPRCommits } from "@/lib/GithubPrFiles"
import { log } from "@/lib/Logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/pr-commits")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

        if (!token) {
          return jsonResponse({ error: "Missing or invalid Authorization header" }, 401)
        }

        let user
        try {
          user = await adminDb.auth.verifyToken(token)
        } catch {
          return jsonResponse({ error: "Invalid token" }, 401)
        }

        if (!user?.id) {
          return jsonResponse({ error: "User not found" }, 401)
        }

        let body: { owner: string; repo: string; pullNumber: number }
        try {
          body = (await request.json()) as typeof body
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const { owner, repo, pullNumber } = body
        if (!owner || !repo || !pullNumber) {
          return jsonResponse({ error: "owner, repo, pullNumber are required" }, 400)
        }

        const fullName = `${owner}/${repo}`
        const { repos } = await adminDb.query({
          repos: {
            $: {
              where: {
                fullName,
                "users.id": user.id,
              },
              limit: 1,
            },
          },
        })

        if (!repos?.length) {
          return jsonResponse({ error: "Repository not found or not authorized" }, 404)
        }

        const installationId = await getInstallationIdForUser(user.id)
        if (!installationId) {
          return jsonResponse({ error: "No GitHub installation found for user" }, 400)
        }

        try {
          const commits = await fetchPRCommits(installationId, owner, repo, pullNumber)
          return jsonResponse({ commits })
        } catch (err) {
          log.error("Failed to fetch PR commits", err)
          const msg = err instanceof Error ? err.message : "Fetch failed"
          return jsonResponse({ error: msg }, 500)
        }
      },
    },
  },
})
