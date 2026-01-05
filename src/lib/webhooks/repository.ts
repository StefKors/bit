import { eq } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload, RepositoryEvent, StarEvent, ForkEvent } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle repository webhook events.
 *
 * Syncs repository metadata updates including:
 * - Name/description changes
 * - Visibility changes (public/private)
 * - Archive/unarchive
 * - Default branch changes
 * - Deletion
 *
 * Auto-tracking behavior:
 * - If repo is tracked → updates metadata for all users tracking it
 * - If not tracked but sender is registered → auto-creates repo
 * - If sender not registered → logs and skips
 */
export async function handleRepositoryWebhook(db: WebhookDB, payload: WebhookPayload) {
  const repoPayload = payload as unknown as RepositoryEvent
  const repo = repoPayload.repository
  const sender = repoPayload.sender
  const action = repoPayload.action

  if (!repo) return

  const repoFullName = repo.full_name
  const now = new Date()

  // Find users who have this repo synced
  let repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender as Record<string, unknown>)
    if (userId) {
      const newRepo = await ensureRepoFromWebhook(
        db,
        repo as unknown as Record<string, unknown>,
        userId,
      )
      if (newRepo) {
        repoRecords = [newRepo]
      }
    }
  }

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName} and sender not registered`)
    return
  }

  // Handle deletion - remove repo records
  if (action === "deleted") {
    for (const repoRecord of repoRecords) {
      await db.delete(dbSchema.githubRepo).where(eq(dbSchema.githubRepo.id, repoRecord.id))
    }
    console.log(`Deleted repo ${repoFullName} from all tracking users`)
    return
  }

  // Update repo metadata for all tracked instances
  for (const repoRecord of repoRecords) {
    await db
      .update(dbSchema.githubRepo)
      .set({
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        description: repo.description || null,
        url: repo.url,
        htmlUrl: repo.html_url,
        private: repo.private || false,
        fork: repo.fork || false,
        defaultBranch: repo.default_branch || "main",
        language: repo.language || null,
        stargazersCount: repo.stargazers_count || 0,
        forksCount: repo.forks_count || 0,
        openIssuesCount: repo.open_issues_count || 0,
        githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : null,
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.githubRepo.id, repoRecord.id))
  }

  console.log(`Processed repository ${action} event for ${repoFullName}`)
}

/**
 * Handle star webhook events.
 *
 * Updates the repository's stargazers count when starred/unstarred.
 *
 * Auto-tracking behavior:
 * - If repo is tracked → updates star count for all users tracking it
 * - If not tracked but sender is registered → auto-creates repo
 * - If sender not registered → logs and skips
 */
export async function handleStarWebhook(db: WebhookDB, payload: WebhookPayload) {
  const starPayload = payload as unknown as StarEvent
  const repo = starPayload.repository
  const sender = starPayload.sender
  const action = starPayload.action

  if (!repo) return

  const repoFullName = repo.full_name
  const now = new Date()

  // Find users who have this repo synced
  let repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender as Record<string, unknown>)
    if (userId) {
      const newRepo = await ensureRepoFromWebhook(
        db,
        repo as unknown as Record<string, unknown>,
        userId,
      )
      if (newRepo) {
        repoRecords = [newRepo]
      }
    }
  }

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName} and sender not registered`)
    return
  }

  // Update star count for all tracked instances
  for (const repoRecord of repoRecords) {
    await db
      .update(dbSchema.githubRepo)
      .set({
        stargazersCount: repo.stargazers_count || 0,
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.githubRepo.id, repoRecord.id))
  }

  console.log(`Processed star ${action} event for ${repoFullName}: ${repo.stargazers_count} stars`)
}

/**
 * Handle fork webhook events.
 *
 * Updates the repository's fork count when forked.
 * Also can auto-track the forked repo for the sender if they're registered.
 *
 * Auto-tracking behavior:
 * - If parent repo is tracked → updates fork count for all users tracking it
 * - If forker is registered → auto-creates the forked repo for them
 */
export async function handleForkWebhook(db: WebhookDB, payload: WebhookPayload) {
  const forkPayload = payload as unknown as ForkEvent
  const repo = forkPayload.repository // The original repo being forked
  const forkee = forkPayload.forkee // The newly created fork
  const sender = forkPayload.sender

  if (!repo || !forkee) return

  const repoFullName = repo.full_name
  const now = new Date()

  // Update fork count on the original repo
  const repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

  for (const repoRecord of repoRecords) {
    await db
      .update(dbSchema.githubRepo)
      .set({
        forksCount: repo.forks_count || 0,
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.githubRepo.id, repoRecord.id))
  }

  // Auto-track the new fork for the sender if they're a registered user
  if (sender) {
    const userId = await findUserBySender(db, sender as Record<string, unknown>)
    if (userId) {
      await ensureRepoFromWebhook(db, forkee as unknown as Record<string, unknown>, userId)
      console.log(`Auto-tracked forked repo ${forkee.full_name} for user ${userId}`)
    }
  }

  console.log(`Processed fork event: ${forkee.full_name} forked from ${repoFullName}`)
}
