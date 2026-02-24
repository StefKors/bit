import { id } from "@instantdb/admin"
import type { PullRequestEvent, WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

const parseGithubTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Handle pull_request webhook events.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates PR for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo and PR
 * - If sender not registered → logs and skips
 */
export async function handlePullRequestWebhook(db: WebhookDB, payload: WebhookPayload) {
  const typedPayload = payload as PullRequestEvent
  const { action, pull_request: pr, repository: repo, sender } = typedPayload

  const repoFullName = repo.full_name
  const githubId = pr.id

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0) {
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
    // Find existing PR by githubId to get its UUID, or generate new one
    const existingResult = await db.query({
      pullRequests: {
        $: { where: { githubId }, limit: 1 },
      },
    })
    const prId = existingResult.pullRequests?.[0]?.id || id()

    const now = Date.now()
    const prData = {
      githubId,
      number: pr.number,
      repoId: repoRecord.id,
      title: pr.title,
      body: pr.body || null,
      state: pr.state,
      draft: pr.draft || false,
      merged: pr.merged || false,
      mergeable: pr.mergeable ?? null,
      mergeableState: pr.mergeable_state || null,
      authorLogin: pr.user?.login || null,
      authorAvatarUrl: pr.user?.avatar_url || null,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      baseSha: pr.base.sha,
      htmlUrl: pr.html_url,
      diffUrl: pr.diff_url,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changed_files ?? 0,
      commits: pr.commits ?? 0,
      comments: pr.comments ?? 0,
      reviewComments: pr.review_comments ?? 0,
      labels: JSON.stringify(
        (pr.labels || []).map((l) => ({
          name: l.name,
          color: l.color,
        })),
      ),
      githubCreatedAt: parseGithubTimestamp(pr.created_at),
      githubUpdatedAt: parseGithubTimestamp(pr.updated_at),
      closedAt: parseGithubTimestamp(pr.closed_at),
      mergedAt: parseGithubTimestamp(pr.merged_at),
      userId: repoRecord.userId,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    if (action === "closed" && pr.merged) {
      prData.merged = true
      prData.mergedAt = parseGithubTimestamp(pr.merged_at) ?? Date.now()
    }

    await db.transact(db.tx.pullRequests[prId].update(prData))
  }

  console.log(`Processed pull_request.${action} for ${repoFullName}#${pr.number}`)
}
