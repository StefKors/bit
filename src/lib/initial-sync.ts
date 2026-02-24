export const INITIAL_SYNC_STALE_MS = 5 * 60 * 1000

export type InitialSyncStateLike = {
  syncStatus?: string
  updatedAt?: number
  createdAt?: number
}

export const isInitialSyncStale = (
  state: InitialSyncStateLike | null | undefined,
  now = Date.now(),
): boolean => {
  if (!state || state.syncStatus !== "syncing") return false

  const heartbeatAt = state.updatedAt ?? state.createdAt
  if (!heartbeatAt) return true

  return now - heartbeatAt > INITIAL_SYNC_STALE_MS
}

export const shouldResumeInitialSync = (
  state: InitialSyncStateLike | null | undefined,
  now = Date.now(),
): boolean => {
  if (!state) return true
  if (state.syncStatus === "completed" || state.syncStatus === "auth_invalid") return false
  if (state.syncStatus === "syncing") return isInitialSyncStale(state, now)
  return true
}
