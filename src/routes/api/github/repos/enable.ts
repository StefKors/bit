import { createFileRoute } from "@tanstack/react-router"
import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"
import { getInstallationIdForRepo } from "@/lib/GithubApp"
import { syncPRFiles } from "@/lib/GithubPrFiles"
import type { InstallationRepo } from "@/lib/GithubInstallationRepos"
import { log } from "@/lib/Logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const backfillOpenPullRequestFiles = async (
  userId: string,
  repos: InstallationRepo[],
): Promise<number> => {
  let backfilledCount = 0

  for (const repo of repos) {
    const installationId = await getInstallationIdForRepo(userId, repo.owner)
    if (!installationId) continue

    const { repos: repoRecords } = await adminDb.query({
      repos: {
        $: { where: { fullName: repo.fullName }, limit: 1 },
        pullRequests: {
          $: { where: { state: "open" } },
        },
      },
    })
    const pullRequests = repoRecords?.[0]?.pullRequests ?? []

    for (const pr of pullRequests) {
      if (!pr.baseSha || !pr.headSha) continue
      try {
        await syncPRFiles(pr.id, installationId, repo.owner, repo.name, pr.baseSha, pr.headSha)
        backfilledCount += 1
      } catch (error) {
        log.error("Failed to backfill PR files on repo enable", error, {
          userId,
          repoFullName: repo.fullName,
          prNumber: pr.number,
        })
      }
    }
  }

  return backfilledCount
}

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

          const backfilledPullRequests = await backfillOpenPullRequestFiles(userId, repos)

          return jsonResponse({ enabled: repos.length, backfilledPullRequests })
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to enable repos"
          return jsonResponse({ error: msg }, 500)
        }
      },
    },
  },
})
