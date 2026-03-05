import { createFileRoute } from "@tanstack/react-router"
import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"
import type { InstallationRepo } from "@/lib/GithubInstallationRepos"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/repos/enable")({
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

        let body: { repos: InstallationRepo[] }
        try {
          body = (await request.json()) as { repos: InstallationRepo[] }
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const { repos } = body
        if (!Array.isArray(repos) || repos.length === 0) {
          return jsonResponse({ error: "repos array is required and must not be empty" }, 400)
        }

        const nodeIds = repos.map((r) => r.nodeId)
        const { repos: existingRepos } = await adminDb.query({
          repos: {
            $: { where: { nodeId: { $in: nodeIds } } },
          },
        })

        const existingByNodeId = new Map((existingRepos ?? []).map((r) => [r.nodeId, r]))

        const now = Date.now()
        const userId = user.id
        const tx = repos.flatMap((repo) => {
          const pushedAt = repo.pushedAt ? new Date(repo.pushedAt).getTime() : undefined
          const existing = existingByNodeId.get(repo.nodeId)

          if (existing) {
            return [adminDb.tx.repos[existing.id].link({ users: userId })]
          }

          const repoId = id()
          return [
            adminDb.tx.repos[repoId]
              .update({
                nodeId: repo.nodeId,
                fullName: repo.fullName,
                name: repo.name,
                owner: repo.owner,
                private: repo.private,
                description: repo.description ?? undefined,
                htmlUrl: repo.htmlUrl,
                pushedAt,
                stargazersCount: repo.stargazersCount,
                forksCount: repo.forksCount,
                language: repo.language ?? undefined,
                defaultBranch: repo.defaultBranch,
                createdAt: now,
                updatedAt: now,
              })
              .link({ users: userId }),
          ]
        })

        try {
          await adminDb.transact(tx)
          return jsonResponse({ enabled: repos.length })
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to enable repos"
          return jsonResponse({ error: msg }, 500)
        }
      },
    },
  },
})
