import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => `job-${Date.now()}-${Math.random()}`),
}))

vi.mock("./instantAdmin", () => {
  const adminDb = {
    query: vi.fn(),
    transact: vi.fn().mockResolvedValue(undefined),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnThis(),
              }),
            },
          ),
      },
    ),
  }
  return { adminDb }
})

vi.mock("./logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { adminDb } from "./instantAdmin"
import {
  createSyncJob,
  startSyncJob,
  updateSyncJobProgress,
  completeSyncJob,
  failSyncJob,
  cancelSyncJob,
  getPendingSyncJobs,
} from "./sync-jobs"
import type { SyncJob } from "./sync-jobs"

const mockedAdminDb = vi.mocked(adminDb)

describe("createSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a sync job with default values", async () => {
    const jobId = await createSyncJob({
      jobType: "repo_sync",
      resourceType: "repo",
      userId: "user-1",
    })

    expect(jobId).toBeDefined()
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })

  it("creates a sync job with custom priority and steps", async () => {
    const jobId = await createSyncJob({
      jobType: "pr_sync",
      resourceType: "pullRequest",
      resourceId: "pr-1",
      userId: "user-1",
      priority: 5,
      totalSteps: 3,
      maxAttempts: 5,
    })

    expect(jobId).toBeDefined()
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })
})

describe("startSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("transitions job to running state", async () => {
    await startSyncJob("job-1")
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })
})

describe("updateSyncJobProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates progress fields", async () => {
    await updateSyncJobProgress("job-1", {
      currentStep: "fetching PRs",
      completedSteps: 2,
      itemsFetched: 50,
    })
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })
})

describe("completeSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks job as completed", async () => {
    await completeSyncJob("job-1")
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })
})

describe("failSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retries when under max attempts", async () => {
    mockedAdminDb.query.mockResolvedValueOnce({
      syncJobs: [
        {
          id: "job-1",
          attempts: 1,
          maxAttempts: 3,
        },
      ],
    } as unknown as { syncJobs: SyncJob[] })

    await failSyncJob("job-1", "Network error")
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })

  it("fails permanently when at max attempts", async () => {
    mockedAdminDb.query.mockResolvedValueOnce({
      syncJobs: [
        {
          id: "job-1",
          attempts: 2,
          maxAttempts: 3,
        },
      ],
    } as unknown as { syncJobs: SyncJob[] })

    await failSyncJob("job-1", "Persistent error")
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })

  it("does nothing when job not found", async () => {
    mockedAdminDb.query.mockResolvedValueOnce({ syncJobs: [] } as unknown as {
      syncJobs: SyncJob[]
    })

    await failSyncJob("nonexistent", "Error")
    expect(mockedAdminDb.transact).not.toHaveBeenCalled()
  })
})

describe("cancelSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks job as cancelled", async () => {
    await cancelSyncJob("job-1")
    expect(mockedAdminDb.transact).toHaveBeenCalled()
  })
})

describe("getPendingSyncJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns due pending jobs", async () => {
    const now = Date.now()
    mockedAdminDb.query.mockResolvedValueOnce({
      syncJobs: [
        { id: "job-1", state: "pending", nextRunAt: now - 1000 },
        { id: "job-2", state: "pending", nextRunAt: now + 60000 },
      ],
    } as unknown as { syncJobs: SyncJob[] })

    const jobs = await getPendingSyncJobs("user-1")
    expect(jobs).toHaveLength(1)
    expect(jobs[0].id).toBe("job-1")
  })

  it("returns jobs without nextRunAt", async () => {
    mockedAdminDb.query.mockResolvedValueOnce({
      syncJobs: [{ id: "job-1", state: "pending" }],
    } as unknown as { syncJobs: SyncJob[] })

    const jobs = await getPendingSyncJobs("user-1")
    expect(jobs).toHaveLength(1)
  })

  it("returns empty array when no pending jobs", async () => {
    mockedAdminDb.query.mockResolvedValueOnce({ syncJobs: [] } as unknown as {
      syncJobs: SyncJob[]
    })

    const jobs = await getPendingSyncJobs("user-1")
    expect(jobs).toHaveLength(0)
  })
})
