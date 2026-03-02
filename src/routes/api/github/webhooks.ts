import { createFileRoute } from "@tanstack/react-router"
import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"
import { mapWithConcurrency } from "@/lib/sync-ingest"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

interface RepoWebhookInfo {
  repoFullName: string
  webhooks: Array<{
    id: number
    url: string
    active: boolean
    events: string[]
    createdAt: string
    updatedAt: string
    isOurs: boolean
  }>
  error?: string
}

export const Route = createFileRoute("/api/github/webhooks")({
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

        const { repos } = await adminDb.query({
          repos: { $: { where: { userId } } },
        })

        const tracked = (repos ?? []).filter(
          (r) => r.webhookStatus === "installed" || r.webhookStatus === "error",
        )

        const results: RepoWebhookInfo[] = await mapWithConcurrency(tracked, 5, async (repo) => {
          const parts = repo.fullName.split("/")
          if (parts.length !== 2) {
            return { repoFullName: repo.fullName, webhooks: [], error: "Invalid repo name" }
          }
          const [owner, repoName] = parts
          try {
            const webhooks = await client.listRepoWebhooks(owner, repoName)
            return { repoFullName: repo.fullName, webhooks }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to list webhooks"
            return { repoFullName: repo.fullName, webhooks: [], error: msg }
          }
        })

        return jsonResponse({ repos: results })
      },

      DELETE: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const body = (await request.json()) as {
          owner?: string
          repo?: string
          hookId?: number
        }

        if (!body.owner || !body.repo || !body.hookId) {
          return jsonResponse({ error: "Missing owner, repo, or hookId" }, 400)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          await client.deleteRepoWebhook(body.owner, body.repo, body.hookId)
          return jsonResponse({ success: true })
        } catch (err) {
          log.error("Error deleting webhook", err, {
            op: "delete-webhook",
            userId,
            repo: `${body.owner}/${body.repo}`,
            hookId: body.hookId,
          })
          return jsonResponse(
            { error: err instanceof Error ? err.message : "Failed to delete webhook" },
            500,
          )
        }
      },
    },
  },
})
