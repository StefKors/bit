import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { listInstallationRepos } from "@/lib/github-installation-repos"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/installation/repos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        try {
          const repos = await listInstallationRepos(user.id)
          return jsonResponse({ repos })
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch repos"
          return jsonResponse({ error: msg }, 500)
        }
      },
    },
  },
})
