import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/InstantAdmin"
import { getInstallationIdForRepo } from "@/lib/GithubApp"
import { createIssueComment } from "@/lib/GithubIssueComment"
import { syncPRActivitySafely } from "@/lib/GithubPrActivity"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/repos/comment")({
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

        let body: { owner: string; repo: string; number: number; body: string }
        try {
          body = (await request.json()) as {
            owner: string
            repo: string
            number: number
            body: string
          }
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const { owner, repo, number, body: commentBody } = body
        if (
          typeof owner !== "string" ||
          typeof repo !== "string" ||
          typeof number !== "number" ||
          typeof commentBody !== "string"
        ) {
          return jsonResponse({ error: "owner, repo, number, and body are required" }, 400)
        }

        const trimmedBody = commentBody.trim()
        if (!trimmedBody) {
          return jsonResponse({ error: "Comment body cannot be empty" }, 400)
        }

        const result = await createIssueComment({
          userId: user.id,
          owner,
          repo,
          issueNumber: number,
          body: trimmedBody,
        })

        if (!result) {
          return jsonResponse(
            {
              error: "Failed to create comment. Ensure the GitHub App is installed and has access.",
            },
            500,
          )
        }

        const fullName = `${owner}/${repo}`
        const { repos } = await adminDb.query({
          repos: {
            $: { where: { fullName }, limit: 1 },
            pullRequests: {
              $: { where: { number }, limit: 1 },
            },
          },
        })

        const pr = repos?.[0]?.pullRequests?.[0]
        if (pr) {
          const installationId = await getInstallationIdForRepo(user.id, owner)
          if (installationId) {
            syncPRActivitySafely({
              pullRequestId: pr.id,
              repoFullName: fullName,
              installationId,
              prNumber: number,
            }).catch(() => {})
          }
        }

        return jsonResponse({ htmlUrl: result.htmlUrl })
      },
    },
  },
})
