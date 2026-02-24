import { describe, expect, it } from "vitest"
import { chunkItems, mapWithConcurrency, selectReposForPullSync } from "./sync-ingest"

describe("chunkItems", () => {
  it("splits arrays into fixed-size chunks", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it("returns empty chunks for empty input", () => {
    expect(chunkItems([], 3)).toEqual([])
  })
})

describe("selectReposForPullSync", () => {
  it("returns all repos with no prior sync state", () => {
    const repos = [{ fullName: "acme/a" }, { fullName: "acme/b", githubPushedAt: 10 }]
    expect(selectReposForPullSync(repos, [])).toEqual(repos)
  })

  it("skips repos with no activity since last pulls sync", () => {
    const repos = [
      { fullName: "acme/a", githubPushedAt: 100, githubUpdatedAt: 110 },
      { fullName: "acme/b", githubPushedAt: 300, githubUpdatedAt: 310 },
    ]
    const syncStates = [
      { resourceId: "acme/a", lastSyncedAt: 200 },
      { resourceId: "acme/b", lastSyncedAt: 305 },
    ]

    expect(selectReposForPullSync(repos, syncStates)).toEqual([{ ...repos[1] }])
  })

  it("keeps repos when timestamp data is missing", () => {
    const repos = [{ fullName: "acme/a" }]
    const syncStates = [{ resourceId: "acme/a", lastSyncedAt: 999 }]
    expect(selectReposForPullSync(repos, syncStates)).toEqual(repos)
  })
})

describe("mapWithConcurrency", () => {
  it("preserves input order", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (item) => {
      await Promise.resolve()
      return item * 2
    })

    expect(result).toEqual([2, 4, 6])
  })

  it("enforces concurrency limit", async () => {
    let active = 0
    let peak = 0

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, item === 1 ? 10 : 1))
      active -= 1
      return item
    })

    expect(peak).toBe(2)
  })
})
