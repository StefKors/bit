import { eq } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload, PushEvent } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle push webhook events.
 *
 * Updates the repository's githubPushedAt timestamp to reflect recent activity.
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
  const commitCount = pushPayload.commits?.length ?? 0

  console.log(
    `Processed push event for ${repoFullName}: ${commitCount} commit(s) to ${branch}`,
  )
}

