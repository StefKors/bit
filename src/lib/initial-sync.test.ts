import { describe, it, expect } from "vitest"
import { INITIAL_SYNC_STALE_MS, isInitialSyncStale, shouldResumeInitialSync } from "./initial-sync"

describe("initial sync stale detection", () => {
  const now = 1_000_000

  it("marks syncing state as stale when heartbeat is too old", () => {
    const staleState = {
      syncStatus: "syncing",
      updatedAt: now - INITIAL_SYNC_STALE_MS - 1,
    }

    expect(isInitialSyncStale(staleState, now)).toBe(true)
  })

  it("keeps syncing state fresh when heartbeat is recent", () => {
    const freshState = {
      syncStatus: "syncing",
      updatedAt: now - 10_000,
    }

    expect(isInitialSyncStale(freshState, now)).toBe(false)
  })

  it("treats syncing state without timestamps as stale", () => {
    expect(isInitialSyncStale({ syncStatus: "syncing" }, now)).toBe(true)
  })

  it("resumes when there is no initial sync state yet", () => {
    expect(shouldResumeInitialSync(null, now)).toBe(true)
  })

  it("does not resume when initial sync is completed", () => {
    expect(shouldResumeInitialSync({ syncStatus: "completed", updatedAt: now }, now)).toBe(false)
  })

  it("does not resume while sync is actively heartbeating", () => {
    expect(
      shouldResumeInitialSync(
        {
          syncStatus: "syncing",
          updatedAt: now - 1_000,
        },
        now,
      ),
    ).toBe(false)
  })

  it("resumes when syncing state is stale", () => {
    expect(
      shouldResumeInitialSync(
        {
          syncStatus: "syncing",
          updatedAt: now - INITIAL_SYNC_STALE_MS - 1,
        },
        now,
      ),
    ).toBe(true)
  })
})
