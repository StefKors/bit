import type { WebhookDB, WebhookPayload, PushEvent, RepoRecord } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle push webhook events.
 *
 * Updates the repository's githubPushedAt timestamp to reflect recent activity.
 * Also syncs commits to any open PRs whose head branch matches the pushed ref.
 * Invalidates cached tree data for the pushed ref so it's re-fetched on next view.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates githubPushedAt for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo
 * - If sender not registered → logs and skips
 */
export async function handlePushWebhook(db: WebhookDB, payload: WebhookPayload) {
  const pushPayload = payload as unknown as PushEvent
  const { repository: repo, sender, ref } = pushPayload
  const repoFullName = repo.full_name
  const pushedAt = Date.now()

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = (reposResult.repos || []) as RepoRecord[]

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

  // Update githubPushedAt for all tracked instances of this repo
  for (const repoRecord of repoRecords) {
    await db.transact(
      db.tx.repos[repoRecord.id].update({
        githubPushedAt: pushedAt,
        syncedAt: pushedAt,
        updatedAt: pushedAt,
      }),
    )
  }

  // Extract branch name from ref (e.g., "refs/heads/main" -> "main")
  const branch = ref.replace("refs/heads/", "").replace("refs/tags/", "")
  const commits = pushPayload.commits ?? []

  // Invalidate cached tree data for the pushed ref
  // This ensures the tree is re-fetched on next view with fresh data
  await invalidateTreeCache(db, repoRecords, branch)

  // Sync commits to any open PRs on this branch
  if (commits.length > 0) {
    await syncCommitsToPRs(db, repoRecords, branch, commits)
  }

  console.log(`Processed push event for ${repoFullName}: ${commits.length} commit(s) to ${branch}`)
}

/**
 * Invalidate cached tree data for a specific branch.
 * Deletes existing tree entries so they're re-fetched from GitHub on next view.
 */
async function invalidateTreeCache(db: WebhookDB, repoRecords: RepoRecord[], branch: string) {
  for (const repoRecord of repoRecords) {
    // Query tree entries for this repo and branch
    const treeResult = await db.query({
      repoTrees: {
        $: { where: { repoId: repoRecord.id, ref: branch } },
      },
    })

    const treeEntries = treeResult.repoTrees || []

    // Delete each tree entry
    if (treeEntries.length > 0) {
      const deleteTxs = treeEntries.map((entry) => db.tx.repoTrees[entry.id].delete())
      await db.transact(deleteTxs)
    }
  }
}

/**
 * Sync pushed commits to all PRs whose head branch matches the pushed ref.
 * This keeps PR commit history up-to-date in real-time as developers push.
 */
async function syncCommitsToPRs(
  db: WebhookDB,
  repoRecords: RepoRecord[],
  branch: string,
  commits: PushEvent["commits"],
) {
  for (const repoRecord of repoRecords) {
    // Find all PRs in this repo where headRef matches the pushed branch
    const prResult = await db.query({
      pullRequests: {
        $: { where: { repoId: repoRecord.id, headRef: branch } },
      },
    })

    const matchingPRs = prResult.pullRequests || []
    if (matchingPRs.length === 0) continue

    // Insert commits for each matching PR
    for (const pr of matchingPRs) {
      for (const commit of commits) {
        const now = Date.now()
        const commitId = `${pr.id}:${commit.id}`
        const commitData = {
          id: commitId,
          pullRequestId: pr.id,
          sha: commit.id,
          message: commit.message,
          authorLogin: commit.author?.username || null,
          authorAvatarUrl: null, // Not available in push webhook payload
          authorName: commit.author?.name || null,
          authorEmail: commit.author?.email || null,
          committerLogin: commit.committer?.username || null,
          committerAvatarUrl: null, // Not available in push webhook payload
          committerName: commit.committer?.name || null,
          committerEmail: commit.committer?.email || null,
          htmlUrl: commit.url,
          committedAt: commit.timestamp ? new Date(commit.timestamp).getTime() : null,
          userId: repoRecord.userId,
          createdAt: now,
          updatedAt: now,
        }

        await db.transact(db.tx.prCommits[commitId].update(commitData))
      }

      // Update the PR's commit count
      const commitCountResult = await db.query({
        prCommits: {
          $: { where: { pullRequestId: pr.id } },
        },
      })

      const commitCount = (commitCountResult.prCommits || []).length

      await db.transact(
        db.tx.pullRequests[pr.id].update({
          commits: commitCount,
          headSha: commits[commits.length - 1]?.id || pr.headSha,
          updatedAt: Date.now(),
        }),
      )

      console.log(`Synced ${commits.length} commit(s) to PR #${pr.number} on branch ${branch}`)
    }
  }
}
