export type RepoActivitySnapshot = {
  fullName: string
  githubPushedAt?: number
  githubUpdatedAt?: number
}

export type PullSyncStateSnapshot = {
  resourceId?: string
  lastSyncedAt?: number
}

export const chunkItems = <T>(items: readonly T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0")
  }

  if (items.length === 0) {
    return []
  }

  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += chunkSize) {
    chunks.push(items.slice(start, start + chunkSize))
  }
  return chunks
}

const getRepoActivityTimestamp = (repo: RepoActivitySnapshot): number | undefined => {
  const pushed = repo.githubPushedAt ?? 0
  const updated = repo.githubUpdatedAt ?? 0
  const latest = Math.max(pushed, updated)
  return latest > 0 ? latest : undefined
}

export const selectReposForPullSync = (
  repos: readonly RepoActivitySnapshot[],
  syncStates: readonly PullSyncStateSnapshot[],
): RepoActivitySnapshot[] => {
  const syncedByRepo = new Map<string, number>()
  for (const state of syncStates) {
    if (!state.resourceId || !state.lastSyncedAt) {
      continue
    }
    syncedByRepo.set(state.resourceId, state.lastSyncedAt)
  }

  return repos.filter((repo) => {
    const lastSyncedAt = syncedByRepo.get(repo.fullName)
    if (!lastSyncedAt) {
      return true
    }

    const activityAt = getRepoActivityTimestamp(repo)
    if (!activityAt) {
      return true
    }

    return activityAt > lastSyncedAt
  })
}

export const mapWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  if (concurrency <= 0) {
    throw new Error("concurrency must be greater than 0")
  }

  if (items.length === 0) {
    return []
  }

  const results = new Array<TResult>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, worker))

  return results
}
