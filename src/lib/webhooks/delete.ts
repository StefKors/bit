import { eq, and } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload, DeleteEvent } from "./types"

/**
 * Handle delete webhook events.
 *
 * Triggered when a branch or tag is deleted in the repository.
 * Removes cached tree data for the deleted ref.
 */
export async function handleDeleteWebhook(db: WebhookDB, payload: WebhookPayload) {
  const deletePayload = payload as unknown as DeleteEvent
  const repo = payload.repository as Record<string, unknown>

  if (!repo) return

  const repoFullName = repo.full_name as string
  const refType = deletePayload.ref_type // 'branch' or 'tag'
  const refName = deletePayload.ref

  // Find users who have this repo synced
  const repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName}`)
    return
  }

  // Delete cached tree data for the deleted ref
  for (const repoRecord of repoRecords) {
    await db
      .delete(dbSchema.githubRepoTree)
      .where(
        and(
          eq(dbSchema.githubRepoTree.repoId, repoRecord.id),
          eq(dbSchema.githubRepoTree.ref, refName),
        ),
      )
  }

  console.log(`Processed delete event for ${repoFullName}: ${refType} "${refName}" deleted`)
}
