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

const unsubscribeBodySchema = z.object({
  repoFullName: z.string().min(3),
})

export const Route = createFileRoute("/api/github/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const bodyResult = unsubscribeBodySchema.safeParse(await request.json())
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
          const { repos } = await adminDb.query({
            repos: {
              $: { where: { fullName: repoFullName, userId }, limit: 1 },
              pullRequests: {
                prReviews: {},
                prComments: {},
                prCommits: {},
                prFiles: {},
                prEvents: {},
              },
              issues: { issueComments: {} },
              repoTrees: {},
              repoBlobs: {},
              repoCommits: {},
              prChecks: {},
            },
          })
          const repoRecord = repos?.[0]
          if (!repoRecord) {
            return jsonResponse({ error: "Repository not found" }, 404)
          }

          const hooks = await client.listRepoWebhooks(owner, repo)
          const ownHooks = hooks.filter((hook) => hook.isOurs)
          for (const hook of ownHooks) {
            await client.deleteRepoWebhook(owner, repo, hook.id)
          }

          if (repoRecord.repoTrees.length > 0) {
            await adminDb.transact(
              repoRecord.repoTrees.map((entry) => adminDb.tx.repoTrees[entry.id].delete()),
            )
          }
          if (repoRecord.repoBlobs.length > 0) {
            await adminDb.transact(
              repoRecord.repoBlobs.map((entry) => adminDb.tx.repoBlobs[entry.id].delete()),
            )
          }
          if (repoRecord.repoCommits.length > 0) {
            await adminDb.transact(
              repoRecord.repoCommits.map((entry) => adminDb.tx.repoCommits[entry.id].delete()),
            )
          }
          if (repoRecord.prChecks.length > 0) {
            await adminDb.transact(
              repoRecord.prChecks.map((entry) => adminDb.tx.prChecks[entry.id].delete()),
            )
          }

          for (const issue of repoRecord.issues) {
            if (issue.issueComments.length > 0) {
              await adminDb.transact(
                issue.issueComments.map((comment) => adminDb.tx.issueComments[comment.id].delete()),
              )
            }
            await adminDb.transact(adminDb.tx.issues[issue.id].delete())
          }

          for (const pullRequest of repoRecord.pullRequests) {
            if (pullRequest.prReviews.length > 0) {
              await adminDb.transact(
                pullRequest.prReviews.map((entry) => adminDb.tx.prReviews[entry.id].delete()),
              )
            }
            if (pullRequest.prComments.length > 0) {
              await adminDb.transact(
                pullRequest.prComments.map((entry) => adminDb.tx.prComments[entry.id].delete()),
              )
            }
            if (pullRequest.prCommits.length > 0) {
              await adminDb.transact(
                pullRequest.prCommits.map((entry) => adminDb.tx.prCommits[entry.id].delete()),
              )
            }
            if (pullRequest.prFiles.length > 0) {
              await adminDb.transact(
                pullRequest.prFiles.map((entry) => adminDb.tx.prFiles[entry.id].delete()),
              )
            }
            if (pullRequest.prEvents.length > 0) {
              await adminDb.transact(
                pullRequest.prEvents.map((entry) => adminDb.tx.prEvents[entry.id].delete()),
              )
            }
            await adminDb.transact(adminDb.tx.pullRequests[pullRequest.id].delete())
          }

          const now = Date.now()
          await adminDb.transact(
            adminDb.tx.repos[repoRecord.id].update({
              subscribed: false,
              webhookStatus: "not_installed",
              webhookError: undefined,
              syncedAt: now,
              updatedAt: now,
            }),
          )

          return jsonResponse({
            success: true,
            repoFullName,
            deletedHooks: ownHooks.length,
          })
        } catch (err) {
          log.error("Failed to unsubscribe repository", err, { userId, repoFullName })
          return jsonResponse(
            { error: err instanceof Error ? err.message : "Failed to unsubscribe repository" },
            500,
          )
        }
      },
    },
  },
})
