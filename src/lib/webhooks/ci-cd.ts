import { id } from "@instantdb/admin"
import type {
  WebhookDB,
  WebhookPayload,
  CheckRunEvent,
  CheckSuiteEvent,
  StatusEvent,
  WorkflowRunEvent,
  WorkflowJobEvent,
} from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"
import { log } from "@/lib/logger"

const findPRByHeadSha = async (db: WebhookDB, sha: string, repoId: string) => {
  const { pullRequests } = await db.query({
    pullRequests: {
      $: { where: { headSha: sha, repoId }, limit: 1 },
    },
  })
  return pullRequests?.[0] ?? null
}

const upsertPrCheck = async (
  db: WebhookDB,
  data: {
    githubId: number
    name: string
    status: string
    conclusion: string | undefined
    headSha: string
    sourceType: string
    repoId: string
    pullRequestId?: string
    externalId?: string
    detailsUrl?: string
    htmlUrl?: string
    workflowName?: string
    workflowPath?: string
    runNumber?: number
    runAttempt?: number
    jobName?: string
    startedAt?: number
    completedAt?: number
  },
) => {
  const { prChecks: existing } = await db.query({
    prChecks: {
      $: {
        where: {
          githubId: data.githubId,
          sourceType: data.sourceType,
          repoId: data.repoId,
        },
        limit: 1,
      },
    },
  })

  const now = Date.now()
  const checkId = existing?.[0]?.id ?? id()

  const checkTx = db.tx.prChecks[checkId]
    .update({
      ...data,
      conclusion: data.conclusion ?? undefined,
      createdAt: existing?.[0]?.createdAt ?? now,
      updatedAt: now,
    })
    .link({ repo: data.repoId })

  await db.transact(
    data.pullRequestId ? checkTx.link({ pullRequest: data.pullRequestId }) : checkTx,
  )

  return checkId
}

export const handleCheckRunWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
): Promise<void> => {
  const typed = payload as CheckRunEvent
  const { check_run, repository, sender } = typed

  if (!check_run || !repository) return

  const repoFullName = repository.full_name
  const { repos } = await db.query({
    repos: { $: { where: { fullName: repoFullName } } },
  })

  let repoRecords = repos || []
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (!userId) {
      log.info("check_run: sender not registered, skipping", { sender: sender.login })
      return
    }
    const repo = await ensureRepoFromWebhook(db, repository, userId)
    if (repo) repoRecords = [repo]
  }

  for (const repoRecord of repoRecords) {
    const pr = await findPRByHeadSha(db, check_run.head_sha, repoRecord.id)

    await upsertPrCheck(db, {
      githubId: check_run.id,
      name: check_run.name,
      status: check_run.status,
      conclusion: check_run.conclusion ?? undefined,
      headSha: check_run.head_sha,
      sourceType: "check_run",
      repoId: repoRecord.id,
      pullRequestId: pr?.id,
      externalId: check_run.external_id ?? undefined,
      detailsUrl: check_run.details_url ?? undefined,
      htmlUrl: check_run.html_url,
      startedAt: check_run.started_at ? new Date(check_run.started_at).getTime() : undefined,
      completedAt: check_run.completed_at ? new Date(check_run.completed_at).getTime() : undefined,
    })
  }

  log.info("check_run processed", {
    name: check_run.name,
    status: check_run.status,
    conclusion: check_run.conclusion,
  })
}

export const handleCheckSuiteWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
): Promise<void> => {
  const typed = payload as CheckSuiteEvent
  const { check_suite, repository, sender } = typed

  if (!check_suite || !repository) return

  const repoFullName = repository.full_name
  const { repos } = await db.query({
    repos: { $: { where: { fullName: repoFullName } } },
  })

  let repoRecords = repos || []
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (!userId) {
      log.info("check_suite: sender not registered, skipping", { sender: sender.login })
      return
    }
    const repo = await ensureRepoFromWebhook(db, repository, userId)
    if (repo) repoRecords = [repo]
  }

  for (const repoRecord of repoRecords) {
    const pr = check_suite.head_sha
      ? await findPRByHeadSha(db, check_suite.head_sha, repoRecord.id)
      : null

    await upsertPrCheck(db, {
      githubId: check_suite.id,
      name: check_suite.app?.name ?? "Check Suite",
      status: check_suite.status ?? "queued",
      conclusion: check_suite.conclusion ?? undefined,
      headSha: check_suite.head_sha,
      sourceType: "check_suite",
      repoId: repoRecord.id,
      pullRequestId: pr?.id,
    })
  }

  log.info("check_suite processed", {
    status: check_suite.status,
    conclusion: check_suite.conclusion,
  })
}

export const handleStatusWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
): Promise<void> => {
  const typed = payload as StatusEvent
  const { sha, state, context, target_url, repository, sender } = typed

  if (!sha || !repository) return

  const repoFullName = repository.full_name
  const { repos } = await db.query({
    repos: { $: { where: { fullName: repoFullName } } },
  })

  let repoRecords = repos || []
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (!userId) {
      log.info("status: sender not registered, skipping", { sender: sender.login })
      return
    }
    const repo = await ensureRepoFromWebhook(db, repository, userId)
    if (repo) repoRecords = [repo]
  }

  for (const repoRecord of repoRecords) {
    const pr = await findPRByHeadSha(db, sha, repoRecord.id)

    const statusToCheckStatus =
      state === "pending"
        ? "in_progress"
        : state === "success" || state === "failure" || state === "error"
          ? "completed"
          : "queued"

    const statusToConclusion =
      state === "success"
        ? "success"
        : state === "failure"
          ? "failure"
          : state === "error"
            ? "failure"
            : undefined

    await upsertPrCheck(db, {
      githubId: typed.id,
      name: context || "status",
      status: statusToCheckStatus,
      conclusion: statusToConclusion,
      headSha: sha,
      sourceType: "status",
      repoId: repoRecord.id,
      pullRequestId: pr?.id,
      detailsUrl: target_url ?? undefined,
    })
  }

  log.info("status processed", { context, state, sha: sha.slice(0, 7) })
}

export const handleWorkflowRunWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
): Promise<void> => {
  const typed = payload as WorkflowRunEvent
  const { workflow_run, repository, sender } = typed

  if (!workflow_run || !repository) return

  const repoFullName = repository.full_name
  const { repos } = await db.query({
    repos: { $: { where: { fullName: repoFullName } } },
  })

  let repoRecords = repos || []
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (!userId) {
      log.info("workflow_run: sender not registered, skipping", { sender: sender.login })
      return
    }
    const repo = await ensureRepoFromWebhook(db, repository, userId)
    if (repo) repoRecords = [repo]
  }

  for (const repoRecord of repoRecords) {
    const pr = workflow_run.head_sha
      ? await findPRByHeadSha(db, workflow_run.head_sha, repoRecord.id)
      : null

    const statusMap: Record<string, string> = {
      queued: "queued",
      in_progress: "in_progress",
      completed: "completed",
      requested: "queued",
      waiting: "queued",
      pending: "queued",
    }

    await upsertPrCheck(db, {
      githubId: workflow_run.id,
      name: workflow_run.name ?? "Workflow Run",
      status: statusMap[workflow_run.status ?? ""] ?? "queued",
      conclusion: workflow_run.conclusion ?? undefined,
      headSha: workflow_run.head_sha,
      sourceType: "workflow_run",
      repoId: repoRecord.id,
      pullRequestId: pr?.id,
      htmlUrl: workflow_run.html_url,
      workflowName: workflow_run.name ?? undefined,
      workflowPath: workflow_run.path,
      runNumber: workflow_run.run_number,
      runAttempt: workflow_run.run_attempt,
      startedAt: workflow_run.run_started_at
        ? new Date(workflow_run.run_started_at).getTime()
        : undefined,
      completedAt: workflow_run.updated_at
        ? new Date(workflow_run.updated_at).getTime()
        : undefined,
    })
  }

  log.info("workflow_run processed", {
    name: workflow_run.name,
    status: workflow_run.status,
    conclusion: workflow_run.conclusion,
  })
}

export const handleWorkflowJobWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
): Promise<void> => {
  const typed = payload as WorkflowJobEvent
  const { workflow_job, repository, sender } = typed

  if (!workflow_job || !repository) return

  const repoFullName = repository.full_name
  const { repos } = await db.query({
    repos: { $: { where: { fullName: repoFullName } } },
  })

  let repoRecords = repos || []
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (!userId) {
      log.info("workflow_job: sender not registered, skipping", { sender: sender.login })
      return
    }
    const repo = await ensureRepoFromWebhook(db, repository, userId)
    if (repo) repoRecords = [repo]
  }

  for (const repoRecord of repoRecords) {
    const pr = workflow_job.head_sha
      ? await findPRByHeadSha(db, workflow_job.head_sha, repoRecord.id)
      : null

    const statusMap: Record<string, string> = {
      queued: "queued",
      in_progress: "in_progress",
      completed: "completed",
      waiting: "queued",
    }

    await upsertPrCheck(db, {
      githubId: workflow_job.id,
      name: workflow_job.name,
      status: statusMap[workflow_job.status] ?? "queued",
      conclusion: workflow_job.conclusion ?? undefined,
      headSha: workflow_job.head_sha,
      sourceType: "workflow_job",
      repoId: repoRecord.id,
      pullRequestId: pr?.id,
      htmlUrl: workflow_job.html_url,
      jobName: workflow_job.name,
      workflowName: workflow_job.workflow_name ?? undefined,
      startedAt: workflow_job.started_at ? new Date(workflow_job.started_at).getTime() : undefined,
      completedAt: workflow_job.completed_at
        ? new Date(workflow_job.completed_at).getTime()
        : undefined,
    })
  }

  log.info("workflow_job processed", {
    name: workflow_job.name,
    status: workflow_job.status,
    conclusion: workflow_job.conclusion,
  })
}
