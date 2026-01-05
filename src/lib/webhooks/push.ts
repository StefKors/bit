import { eq, and } from "drizzle-orm"
import * as dbSchema from "../../../schema"
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
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!repo) return

  const repoFullName = repo.full_name as string
  const ref = pushPayload.ref
  const pushedAt = new Date()

  // Find users who have this repo synced
  let repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

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

  // Update githubPushedAt for all tracked instances of this repo
  for (const repoRecord of repoRecords) {
    await db
      .update(dbSchema.githubRepo)
      .set({
        githubPushedAt: pushedAt,
        syncedAt: pushedAt,
        updatedAt: pushedAt,
      })
      .where(eq(dbSchema.githubRepo.id, repoRecord.id))
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
    await db
      .delete(dbSchema.githubRepoTree)
      .where(
        and(
          eq(dbSchema.githubRepoTree.repoId, repoRecord.id),
          eq(dbSchema.githubRepoTree.ref, branch),
        ),
      )
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
    const matchingPRs = await db
      .select()
      .from(dbSchema.githubPullRequest)
      .where(
        and(
          eq(dbSchema.githubPullRequest.repoId, repoRecord.id),
          eq(dbSchema.githubPullRequest.headRef, branch),
        ),
      )

    if (matchingPRs.length === 0) continue

    // Insert commits for each matching PR
    for (const pr of matchingPRs) {
      for (const commit of commits) {
        const commitData = {
          id: `${pr.id}:${commit.id}`,
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
          committedAt: commit.timestamp ? new Date(commit.timestamp) : null,
          userId: repoRecord.userId,
        }

        await db
          .insert(dbSchema.githubPrCommit)
          .values(commitData)
          .onConflictDoUpdate({
            target: dbSchema.githubPrCommit.id,
            set: {
              message: commitData.message,
              authorLogin: commitData.authorLogin,
              authorName: commitData.authorName,
              authorEmail: commitData.authorEmail,
              committerLogin: commitData.committerLogin,
              committerName: commitData.committerName,
              committerEmail: commitData.committerEmail,
              htmlUrl: commitData.htmlUrl,
              committedAt: commitData.committedAt,
              updatedAt: new Date(),
            },
          })
      }

      // Update the PR's commit count
      const commitCount = await db
        .select()
        .from(dbSchema.githubPrCommit)
        .where(eq(dbSchema.githubPrCommit.pullRequestId, pr.id))

      await db
        .update(dbSchema.githubPullRequest)
        .set({
          commits: commitCount.length,
          headSha: commits[commits.length - 1]?.id || pr.headSha,
          updatedAt: new Date(),
        })
        .where(eq(dbSchema.githubPullRequest.id, pr.id))

      console.log(`Synced ${commits.length} commit(s) to PR #${pr.number} on branch ${branch}`)
    }
  }
}
