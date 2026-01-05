import { eq } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload, CreateEvent } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle create webhook events.
 *
 * Triggered when a branch or tag is created in the repository.
 * Updates the repository's syncedAt timestamp and optionally
 * tracks the new ref for tree syncing.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates syncedAt for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo
 * - If sender not registered → logs and skips
 */
export async function handleCreateWebhook(db: WebhookDB, payload: WebhookPayload) {
  const createPayload = payload as unknown as CreateEvent
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!repo) return

  const repoFullName = repo.full_name as string
  const refType = createPayload.ref_type // 'branch' or 'tag'
  const refName = createPayload.ref
  const now = new Date()

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

  // Update syncedAt for all tracked instances of this repo
  for (const repoRecord of repoRecords) {
    await db
      .update(dbSchema.githubRepo)
      .set({
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.githubRepo.id, repoRecord.id))
  }

  console.log(`Processed create event for ${repoFullName}: ${refType} "${refName}" created`)
}
