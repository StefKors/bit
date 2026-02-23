import { id } from "@instantdb/admin"
import { adminDb } from "./instantAdmin"
import { log } from "./logger"

export type SyncJobState = "pending" | "running" | "completed" | "failed" | "cancelled"

export type SyncJobType =
  | "repo_sync"
  | "pr_sync"
  | "overview_sync"
  | "tree_sync"
  | "issue_sync"
  | "commits_sync"

export type CreateSyncJobInput = {
  jobType: SyncJobType
  resourceType: string
  resourceId?: string
  userId: string
  priority?: number
  totalSteps?: number
  maxAttempts?: number
}

export type SyncJob = {
  id: string
  jobType: string
  resourceType: string
  resourceId?: string
  state: SyncJobState
  priority: number
  nextRunAt?: number
  currentStep?: string
  completedSteps: number
  totalSteps?: number
  itemsFetched: number
  attempts: number
  maxAttempts: number
  error?: string
  userId: string
  startedAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
}

export const createSyncJob = async (input: CreateSyncJobInput): Promise<string> => {
  const jobId = id()
  const now = Date.now()

  await adminDb.transact(
    adminDb.tx.syncJobs[jobId].update({
      jobType: input.jobType,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? undefined,
      state: "pending",
      priority: input.priority ?? 10,
      nextRunAt: now,
      completedSteps: 0,
      totalSteps: input.totalSteps ?? undefined,
      itemsFetched: 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
    }),
  )

  log.info("Sync job created", { jobId, jobType: input.jobType, resourceType: input.resourceType })
  return jobId
}

export const startSyncJob = async (jobId: string): Promise<void> => {
  const now = Date.now()
  await adminDb.transact(
    adminDb.tx.syncJobs[jobId].update({
      state: "running",
      startedAt: now,
      updatedAt: now,
    }),
  )
}

export const updateSyncJobProgress = async (
  jobId: string,
  update: {
    currentStep?: string
    completedSteps?: number
    itemsFetched?: number
  },
): Promise<void> => {
  await adminDb.transact(
    adminDb.tx.syncJobs[jobId].update({
      ...update,
      updatedAt: Date.now(),
    }),
  )
}

export const completeSyncJob = async (jobId: string): Promise<void> => {
  const now = Date.now()
  await adminDb.transact(
    adminDb.tx.syncJobs[jobId].update({
      state: "completed",
      completedAt: now,
      updatedAt: now,
    }),
  )
  log.info("Sync job completed", { jobId })
}

export const failSyncJob = async (jobId: string, error: string): Promise<void> => {
  const now = Date.now()

  const { syncJobs } = await adminDb.query({
    syncJobs: { $: { where: { id: jobId }, limit: 1 } },
  })

  const job = syncJobs?.[0] as SyncJob | undefined
  if (!job) return

  const newAttempts = job.attempts + 1
  const maxed = newAttempts >= job.maxAttempts

  if (maxed) {
    await adminDb.transact(
      adminDb.tx.syncJobs[jobId].update({
        state: "failed",
        error,
        attempts: newAttempts,
        completedAt: now,
        updatedAt: now,
      }),
    )
    log.error("Sync job failed permanently", new Error(error), {
      jobId,
      attempts: newAttempts,
    })
  } else {
    const backoff = 1000 * 2 ** newAttempts + Math.floor(Math.random() * 1000)
    await adminDb.transact(
      adminDb.tx.syncJobs[jobId].update({
        state: "pending",
        error,
        attempts: newAttempts,
        nextRunAt: now + backoff,
        updatedAt: now,
      }),
    )
    log.warn("Sync job failed, will retry", {
      jobId,
      attempt: newAttempts,
      nextRetryIn: `${backoff}ms`,
    })
  }
}

export const cancelSyncJob = async (jobId: string): Promise<void> => {
  const now = Date.now()
  await adminDb.transact(
    adminDb.tx.syncJobs[jobId].update({
      state: "cancelled",
      completedAt: now,
      updatedAt: now,
    }),
  )
  log.info("Sync job cancelled", { jobId })
}

export const getPendingSyncJobs = async (userId: string, limit = 10): Promise<SyncJob[]> => {
  const now = Date.now()
  const { syncJobs } = await adminDb.query({
    syncJobs: {
      $: {
        where: {
          userId,
          state: "pending",
        },
        limit,
      },
    },
  })

  return ((syncJobs || []) as unknown as SyncJob[]).filter(
    (job) => !job.nextRunAt || job.nextRunAt <= now,
  )
}
