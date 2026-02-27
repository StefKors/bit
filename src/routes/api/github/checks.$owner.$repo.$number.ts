import { createFileRoute } from "@tanstack/react-router"
import { id } from "@instantdb/admin"
import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"
import { RequestError } from "octokit"

interface CheckItem {
  githubId: number
  name: string
  status: string
  conclusion: string | null
  detailsUrl: string | null
  htmlUrl: string | null
  startedAt: number | null
  completedAt: number | null
}

type CheckRecord = Record<string, string | number | boolean | null | undefined>

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

const mapChecks = (checks: CheckRecord[]): CheckItem[] =>
  checks.map((check) => ({
    githubId: typeof check.githubId === "number" ? check.githubId : 0,
    name: typeof check.name === "string" ? check.name : "Unknown check",
    status: typeof check.status === "string" ? check.status : "queued",
    conclusion: typeof check.conclusion === "string" ? check.conclusion : null,
    detailsUrl: typeof check.detailsUrl === "string" ? check.detailsUrl : null,
    htmlUrl: typeof check.htmlUrl === "string" ? check.htmlUrl : null,
    startedAt: typeof check.startedAt === "number" ? check.startedAt : null,
    completedAt: typeof check.completedAt === "number" ? check.completedAt : null,
  }))

export const Route = createFileRoute("/api/github/checks/$owner/$repo/$number")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)

        const pullNumber = parseInt((params as { number: string }).number, 10)
        if (Number.isNaN(pullNumber))
          return jsonResponse({ error: "Invalid pull request number" }, 400)

        const client = await createGitHubClient(userId)
        if (!client)
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const fullName = `${owner}/${repo}`
          const { repos } = await adminDb.query({
            repos: {
              $: {
                where: { fullName, userId },
                limit: 1,
              },
            },
          })
          const repoRecord = repos?.[0]
          if (!repoRecord)
            return jsonResponse({ error: "Repository not found", code: "not_found" }, 404)

          const { pullRequests } = await adminDb.query({
            pullRequests: {
              $: {
                where: {
                  number: pullNumber,
                  repoId: repoRecord.id,
                },
                limit: 1,
              },
            },
          })
          const pr = pullRequests?.[0]
          if (!pr) return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)

          const { prChecks } = await adminDb.query({
            prChecks: {
              $: {
                where: {
                  pullRequestId: pr.id,
                },
              },
            },
          })
          const existingChecks = mapChecks((prChecks ?? []) as CheckRecord[])
          if (existingChecks.length > 0) {
            return jsonResponse({ checks: existingChecks })
          }

          if (typeof pr.headSha !== "string" || pr.headSha.length === 0) {
            return jsonResponse({ checks: [] })
          }

          const fetchedChecks = await client.listCheckRuns(owner, repo, pr.headSha)
          const now = Date.now()
          for (const check of fetchedChecks.checks) {
            const { prChecks: existingByGithubId } = await adminDb.query({
              prChecks: {
                $: {
                  where: {
                    githubId: check.githubId,
                    sourceType: "check_run",
                    repoId: repoRecord.id,
                  },
                  limit: 1,
                },
              },
            })
            const existingCheck = existingByGithubId?.[0]
            const checkId = existingCheck?.id ?? id()

            await adminDb.transact(
              adminDb.tx.prChecks[checkId]
                .update({
                  githubId: check.githubId,
                  name: check.name,
                  status: check.status,
                  conclusion: check.conclusion ?? undefined,
                  detailsUrl: check.detailsUrl ?? undefined,
                  htmlUrl: check.htmlUrl ?? undefined,
                  startedAt: check.startedAt ?? undefined,
                  completedAt: check.completedAt ?? undefined,
                  headSha: pr.headSha,
                  sourceType: "check_run",
                  repoId: repoRecord.id,
                  pullRequestId: pr.id,
                  createdAt: existingCheck?.createdAt ?? now,
                  updatedAt: now,
                })
                .link({ repo: repoRecord.id })
                .link({ pullRequest: pr.id }),
            )
          }

          return jsonResponse({ checks: fetchedChecks.checks })
        } catch (error) {
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              { error: "GitHub authentication expired", code: "auth_invalid" },
              401,
            )
          }
          if (error instanceof RequestError) {
            if (error.status === 404)
              return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }
          log.error("Unexpected checks fetch error", error, {
            owner,
            repo,
            pullNumber,
            userId,
          })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },
    },
  },
})
