import { createFileRoute } from "@tanstack/react-router"
import { Octokit } from "octokit"
import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/instantAdmin"
import { isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/$owner/$repo/issue/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { owner, repo, number } = params
        const issueNumber = parseInt(number, 10)

        if (isNaN(issueNumber)) {
          return jsonResponse({ error: "Invalid issue number" }, 400)
        }

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
        const fullName = `${owner}/${repo}`

        try {
          const { repos } = await adminDb.query({
            repos: {
              $: { where: { fullName } },
            },
          })

          const repoRecord = repos?.[0]
          if (!repoRecord) {
            return jsonResponse({ error: "Repository not found in database" }, 404)
          }

          const issueResponse = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
          })

          const issueData = issueResponse.data
          const now = Date.now()

          const { issues: existingIssues } = await adminDb.query({
            issues: {
              $: { where: { githubId: issueData.id } },
            },
          })

          const issueId = existingIssues?.[0]?.id || id()

          await adminDb.transact(
            adminDb.tx.issues[issueId]
              .update({
                githubId: issueData.id,
                number: issueData.number,
                title: issueData.title,
                body: issueData.body || undefined,
                state: issueData.state,
                stateReason: issueData.state_reason || undefined,
                authorLogin: issueData.user?.login || undefined,
                authorAvatarUrl: issueData.user?.avatar_url || undefined,
                htmlUrl: issueData.html_url,
                labels: JSON.stringify(
                  issueData.labels.map((l) =>
                    typeof l === "string" ? { name: l } : { name: l.name, color: l.color },
                  ),
                ),
                comments: issueData.comments,
                githubCreatedAt: issueData.created_at
                  ? new Date(issueData.created_at).getTime()
                  : undefined,
                githubUpdatedAt: issueData.updated_at
                  ? new Date(issueData.updated_at).getTime()
                  : undefined,
                closedAt: issueData.closed_at ? new Date(issueData.closed_at).getTime() : undefined,
                repoId: repoRecord.id,
                userId,
                syncedAt: now,
                createdAt: now,
                updatedAt: now,
              })
              .link({ user: userId })
              .link({ repo: repoRecord.id }),
          )

          const allComments = await octokit.paginate(octokit.rest.issues.listComments, {
            owner,
            repo,
            issue_number: issueNumber,
            per_page: 100,
          })

          for (const comment of allComments) {
            const { issueComments: existingComments } = await adminDb.query({
              issueComments: {
                $: { where: { githubId: comment.id } },
              },
            })

            const commentId = existingComments?.[0]?.id || id()

            await adminDb.transact(
              adminDb.tx.issueComments[commentId]
                .update({
                  githubId: comment.id,
                  body: comment.body || undefined,
                  authorLogin: comment.user?.login || undefined,
                  authorAvatarUrl: comment.user?.avatar_url || undefined,
                  htmlUrl: comment.html_url,
                  githubCreatedAt: comment.created_at
                    ? new Date(comment.created_at).getTime()
                    : undefined,
                  githubUpdatedAt: comment.updated_at
                    ? new Date(comment.updated_at).getTime()
                    : undefined,
                  issueId,
                  createdAt: now,
                  updatedAt: now,
                })
                .link({ user: userId })
                .link({ issue: issueId }),
            )
          }

          return jsonResponse({
            issueId,
            commentsCount: allComments.length,
          })
        } catch (error) {
          console.error("Error syncing issue:", error)

          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              {
                error: "GitHub authentication expired",
                code: "auth_invalid",
                details:
                  "Your GitHub token is no longer valid. Please reconnect your GitHub account.",
              },
              401,
            )
          }

          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status
            if (status === 404) {
              return jsonResponse(
                {
                  error: "Issue not found",
                  details: `Could not find issue #${issueNumber} in ${owner}/${repo}`,
                },
                404,
              )
            }
          }

          return jsonResponse(
            {
              error: "Failed to sync issue",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
