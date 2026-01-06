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
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  const repoRecords = reposResult.repos || []

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName}`)
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

  console.log(`Processed delete event for ${repoFullName}: ${refType} "${refName}" deleted`)
}
