import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { adminDb } from "@/lib/instantAdmin"
import { createGitHubClient } from "@/lib/github-client"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const subscribeBodySchema = z.object({
  repoFullName: z.string().min(3),
})

export const Route = createFileRoute("/api/github/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const bodyResult = subscribeBodySchema.safeParse(await request.json())
        if (!bodyResult.success) {
          return jsonResponse({ error: "Invalid request body" }, 400)
        }

        const { repoFullName } = bodyResult.data
        const [owner, repo] = repoFullName.split("/")
        if (!owner || !repo) {
          return jsonResponse({ error: "Invalid repository full name" }, 400)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const now = Date.now()
          const { repos } = await adminDb.query({
            repos: {
              $: { where: { fullName: repoFullName, userId }, limit: 1 },
            },
          })
          const existingRepo = repos?.[0]
          if (!existingRepo) {
            return jsonResponse({ error: "Repository not found" }, 404)
          }

          await adminDb.transact(
            adminDb.tx.repos[existingRepo.id].update({
              subscribed: true,
              updatedAt: now,
            }),
          )

          const [pullResult, webhookResult] = await Promise.all([
            client.fetchPullRequests(owner, repo, "open", true),
            client.registerRepoWebhook(owner, repo),
          ])

          return jsonResponse({
            success: true,
            repoFullName,
            pullRequests: pullResult.data.length,
            webhookStatus: webhookResult.status,
          })
        } catch (err) {
          log.error("Failed to subscribe repository", err, { userId, repoFullName })
          return jsonResponse(
            { error: err instanceof Error ? err.message : "Failed to subscribe repository" },
            500,
          )
        }
      },
    },
  },
})
