import { id } from "@instantdb/admin"
import { adminDb } from "./instantAdmin"

/**
 * Find an existing sync state by fields, or return a new UUID for creation.
 * This allows upserting sync states without needing deterministic IDs.
 */
export async function findOrCreateSyncStateId(
  resourceType: string,
  userId: string,
  resourceId?: string,
): Promise<string> {
  const { syncStates } = await adminDb.query({
    syncStates: {
      $: {
        where: {
          resourceType,
          userId,
          ...(resourceId ? { resourceId } : {}),
        },
      },
    },
  })
  return syncStates?.[0]?.id ?? id()
}
