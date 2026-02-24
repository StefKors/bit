import { useMutationState } from "@tanstack/react-query"

export const useSyncStatus = (mutationKey: readonly (string | number)[]) => {
  const states = useMutationState({
    filters: { mutationKey },
    select: (m) => ({ status: m.state.status, error: m.state.error }),
  })
  const latest = states[states.length - 1]
  return {
    isSyncing: latest?.status === "pending",
    error: latest?.error instanceof Error ? latest.error.message : null,
  }
}
