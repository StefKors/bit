import type { WebhookDB, WebhookPayload, DeleteEvent } from "./types"
import { log } from "@/lib/logger"

/**
 * Handle delete webhook events.
 *
 * Triggered when a branch or tag is deleted in the repository.
 * Removes cached tree data for the deleted ref.
 */
export async function handleDeleteWebhook(db: WebhookDB, payload: WebhookPayload) {
  const deletePayload = payload as DeleteEvent
  const { repository: repo } = deletePayload
  const repoFullName = repo.full_name
  const refType = deletePayload.ref_type // 'branch' or 'tag'
  const refName = deletePayload.ref

  log.info("Webhook delete: updating entities", {
    op: "webhook-handler-delete",
    entity: "repoTrees",
    repo: repoFullName,
    refType,
    ref: refName,
    dataToUpdate: "repoTrees (delete cached tree entries)",
  })

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  const repoRecords = reposResult.repos || []

  if (repoRecords.length === 0) {
    log.info("Webhook delete: no users tracking repo, skipping", {
      op: "webhook-handler-delete",
      repo: repoFullName,
    })
    return
  }

  // Delete cached tree data for the deleted ref
  for (const repoRecord of repoRecords) {
    // Query tree entries for this repo and ref
    const treeResult = await db.query({
      repoTrees: {
        $: { where: { repoId: repoRecord.id, ref: refName } },
      },
    })

    const treeEntries = treeResult.repoTrees || []

    // Delete each tree entry
    if (treeEntries.length > 0) {
      const deleteTxs = treeEntries.map((entry) => db.tx.repoTrees[entry.id].delete())
      await db.transact(deleteTxs)
    }
  }

  log.info("Webhook delete: processed", {
    op: "webhook-handler-delete",
    repo: repoFullName,
    refType,
    ref: refName,
  })
}
