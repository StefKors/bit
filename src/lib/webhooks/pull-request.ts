import type { WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle pull_request webhook events.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates PR for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo and PR
 * - If sender not registered → logs and skips
 */
export async function handlePullRequestWebhook(db: WebhookDB, payload: WebhookPayload) {
  const action = payload.action as string
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!pr || !repo) return

  const repoFullName = repo.full_name as string
  const prNodeId = pr.node_id as string

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const newRepo = await ensureRepoFromWebhook(db, repo, userId)
      if (newRepo) {
        repoRecords = [newRepo]
      }
    }
  }

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName} and sender not registered`)
    return
  }

  for (const repoRecord of repoRecords) {
    const now = Date.now()
    const prData = {
      id: prNodeId,
      githubId: pr.id as number,
      number: pr.number as number,
      repoId: repoRecord.id,
      title: pr.title as string,
      body: (pr.body as string) || null,
      state: pr.state as string,
      draft: (pr.draft as boolean) || false,
      merged: (pr.merged as boolean) || false,
      mergeable: (pr.mergeable as boolean) ?? null,
      mergeableState: (pr.mergeable_state as string) || null,
      authorLogin: ((pr.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((pr.user as Record<string, unknown>)?.avatar_url as string) || null,
      headRef: (pr.head as Record<string, unknown>)?.ref as string,
      headSha: (pr.head as Record<string, unknown>)?.sha as string,
      baseRef: (pr.base as Record<string, unknown>)?.ref as string,
      baseSha: (pr.base as Record<string, unknown>)?.sha as string,
      htmlUrl: pr.html_url as string,
      diffUrl: pr.diff_url as string,
      additions: (pr.additions as number) ?? 0,
      deletions: (pr.deletions as number) ?? 0,
      changedFiles: (pr.changed_files as number) ?? 0,
      commits: (pr.commits as number) ?? 0,
      comments: (pr.comments as number) ?? 0,
      reviewComments: (pr.review_comments as number) ?? 0,
      labels: JSON.stringify(
        ((pr.labels as Array<Record<string, unknown>>) || []).map((l) => ({
          name: l.name,
          color: l.color,
        })),
      ),
      githubCreatedAt: new Date(pr.created_at as string).getTime(),
      githubUpdatedAt: new Date(pr.updated_at as string).getTime(),
      closedAt: pr.closed_at ? new Date(pr.closed_at as string).getTime() : null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at as string).getTime() : null,
      userId: repoRecord.userId,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    if (action === "closed" && pr.merged) {
      prData.merged = true
      prData.mergedAt = pr.merged_at ? new Date(pr.merged_at as string).getTime() : Date.now()
    }

    await db.transact(db.tx.pullRequests[prNodeId].update(prData))
  }

  console.log(`Processed pull_request.${action} for ${repoFullName}#${pr.number as number}`)
}
