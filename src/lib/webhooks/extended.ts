import { id } from "@instantdb/admin"
import type { PRRecord, RepoRecord, WebhookDB, WebhookEventName, WebhookPayload } from "./types"
import { findUserBySender, ensurePRFromWebhook, ensureRepoFromWebhook } from "./utils"
import { ensureOrgFromWebhook } from "./organization"
import { ensureIssueFromWebhook } from "./issue"
import { log } from "@/lib/logger"

type UnknownRecord = Record<string, unknown>

type OrganizationRecord = {
  id: string
  login?: string
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toRecord = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null)

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const toBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null

const toTimestampOrNull = (value: unknown): number | null => {
  if (typeof value !== "string") return null

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const setIfPresent = <T extends string | number | boolean>(
  target: Record<string, unknown>,
  key: string,
  value: T | null,
): void => {
  if (value !== null) {
    target[key] = value
  }
}

const getTrackedRepos = async (
  db: WebhookDB,
  repository: UnknownRecord,
  sender: UnknownRecord | null,
): Promise<RepoRecord[]> => {
  const fullName = toStringOrNull(repository.full_name)
  if (!fullName) return []

  const result = await db.query({
    repos: {
      $: { where: { fullName } },
    },
  })

  let repoRecords = (result.repos || []) as RepoRecord[]

  if (repoRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const createdRepo = await ensureRepoFromWebhook(db, repository, userId)
      if (createdRepo) {
        repoRecords = [createdRepo]
      }
    }
  }

  return repoRecords
}

const syncRepoMetadata = async (
  db: WebhookDB,
  repository: UnknownRecord,
  repoRecords: RepoRecord[],
): Promise<void> => {
  const owner = toRecord(repository.owner)
  const now = Date.now()

  const updateData: Record<string, unknown> = {
    syncedAt: now,
    updatedAt: now,
  }

  setIfPresent(updateData, "name", toStringOrNull(repository.name))
  setIfPresent(updateData, "fullName", toStringOrNull(repository.full_name))
  setIfPresent(updateData, "owner", toStringOrNull(owner?.login))
  updateData.description = toStringOrNull(repository.description)
  setIfPresent(updateData, "url", toStringOrNull(repository.url))
  setIfPresent(updateData, "htmlUrl", toStringOrNull(repository.html_url))
  setIfPresent(updateData, "defaultBranch", toStringOrNull(repository.default_branch))
  updateData.language = toStringOrNull(repository.language)
  setIfPresent(updateData, "private", toBooleanOrNull(repository.private))
  setIfPresent(updateData, "fork", toBooleanOrNull(repository.fork))
  setIfPresent(updateData, "stargazersCount", toNumberOrNull(repository.stargazers_count))
  setIfPresent(updateData, "forksCount", toNumberOrNull(repository.forks_count))
  setIfPresent(updateData, "openIssuesCount", toNumberOrNull(repository.open_issues_count))

  const githubUpdatedAt = toTimestampOrNull(repository.updated_at)
  if (githubUpdatedAt !== null) {
    updateData.githubUpdatedAt = githubUpdatedAt
  }

  const githubPushedAt = toTimestampOrNull(repository.pushed_at)
  if (githubPushedAt !== null) {
    updateData.githubPushedAt = githubPushedAt
  }

  for (const repoRecord of repoRecords) {
    await db.transact(db.tx.repos[repoRecord.id].update(updateData))
  }
}

const getTrackedOrgs = async (
  db: WebhookDB,
  organization: UnknownRecord,
  sender: UnknownRecord | null,
): Promise<OrganizationRecord[]> => {
  const orgLogin = toStringOrNull(organization.login)
  if (!orgLogin) return []

  const result = await db.query({
    organizations: {
      $: { where: { login: orgLogin } },
    },
  })

  let orgRecords = (result.organizations || []) as OrganizationRecord[]

  if (orgRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const createdOrg = await ensureOrgFromWebhook(db, organization, userId)
      if (createdOrg && isRecord(createdOrg) && typeof createdOrg.id === "string") {
        orgRecords = [createdOrg as unknown as OrganizationRecord]
      }
    }
  }

  return orgRecords
}

const syncOrganizationMetadata = async (
  db: WebhookDB,
  organization: UnknownRecord,
  orgRecords: OrganizationRecord[],
): Promise<void> => {
  const now = Date.now()

  const updateData: Record<string, unknown> = {
    syncedAt: now,
    updatedAt: now,
  }

  setIfPresent(updateData, "login", toStringOrNull(organization.login))
  updateData.name = toStringOrNull(organization.name)
  updateData.description = toStringOrNull(organization.description)
  updateData.avatarUrl = toStringOrNull(organization.avatar_url)
  updateData.url = toStringOrNull(organization.url)

  for (const orgRecord of orgRecords) {
    await db.transact(db.tx.organizations[orgRecord.id].update(updateData))
  }
}

const extractEventGithubId = (payload: WebhookPayload): number | null => {
  const idKeys = ["id", "thread", "comment", "review", "deployment", "deployment_status"]

  for (const key of idKeys) {
    const value = payload[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }

    if (isRecord(value)) {
      const nestedId = toNumberOrNull(value.id)
      if (nestedId !== null) {
        return nestedId
      }
    }
  }

  return null
}

const extractEventCreatedAt = (payload: WebhookPayload): number | null => {
  const timestampKeys = [
    "updated_at",
    "created_at",
    "submitted_at",
    "published_at",
    "run_started_at",
  ]

  for (const key of timestampKeys) {
    const value = payload[key]
    if (typeof value === "string") {
      const timestamp = toTimestampOrNull(value)
      if (timestamp !== null) {
        return timestamp
      }
    }

    if (isRecord(value)) {
      const recordTimestamp =
        toTimestampOrNull(value.updated_at) ??
        toTimestampOrNull(value.created_at) ??
        toTimestampOrNull(value.submitted_at)

      if (recordTimestamp !== null) {
        return recordTimestamp
      }
    }
  }

  return null
}

const createPREventFromWebhook = async (
  db: WebhookDB,
  pullRequestRecord: PRRecord,
  sender: UnknownRecord | null,
  payload: WebhookPayload,
  event: WebhookEventName,
): Promise<void> => {
  const now = Date.now()
  const action = toStringOrNull(payload.action)

  const serializedEvent = JSON.stringify({
    event,
    action,
    ref: toStringOrNull(payload.ref),
    state: toStringOrNull(payload.state),
    senderLogin: toStringOrNull(sender?.login),
  })

  const transaction = db.tx.prEvents[id()]
    .update({
      githubId: extractEventGithubId(payload) ?? undefined,
      eventType: action ? `${event}.${action}` : event,
      actorLogin: toStringOrNull(sender?.login),
      actorAvatarUrl: toStringOrNull(sender?.avatar_url),
      eventData: serializedEvent,
      pullRequestId: pullRequestRecord.id,
      eventCreatedAt: extractEventCreatedAt(payload) ?? now,
      createdAt: now,
      updatedAt: now,
    })
    .link({ pullRequest: pullRequestRecord.id })
    .link({ user: pullRequestRecord.userId })

  await db.transact(transaction)
}

const ensureIssueTracking = async (
  db: WebhookDB,
  issue: UnknownRecord,
  repoRecords: RepoRecord[],
): Promise<void> => {
  if (issue.pull_request) return

  for (const repoRecord of repoRecords) {
    await ensureIssueFromWebhook(db, issue, repoRecord)
  }
}

const ensurePullRequestTracking = async (
  db: WebhookDB,
  pullRequest: UnknownRecord,
  sender: UnknownRecord | null,
  payload: WebhookPayload,
  repoRecords: RepoRecord[],
  event: WebhookEventName,
): Promise<void> => {
  for (const repoRecord of repoRecords) {
    const pullRequestRecord = await ensurePRFromWebhook(db, pullRequest, repoRecord)
    if (!pullRequestRecord) continue

    await createPREventFromWebhook(db, pullRequestRecord, sender, payload, event)
  }
}

/**
 * Handles event families without dedicated, schema-specific handlers yet.
 * It still performs full resource sync behavior:
 * - auto-tracks repo/org resources when sender is registered
 * - syncs repo/org metadata for tracked records
 * - ensures PR/Issue records exist when payload contains those resources
 * - stores PR timeline records for PR-scoped payloads
 */
export const handleExtendedWebhook = async (
  db: WebhookDB,
  payload: WebhookPayload,
  event: WebhookEventName,
): Promise<void> => {
  const repository = toRecord(payload.repository)
  const organization = toRecord(payload.organization)
  const pullRequest = toRecord(payload.pull_request)
  const issue = toRecord(payload.issue)
  const sender = toRecord(payload.sender)

  let repoRecords: RepoRecord[] = []
  if (repository) {
    repoRecords = await getTrackedRepos(db, repository, sender)
    if (repoRecords.length > 0) {
      await syncRepoMetadata(db, repository, repoRecords)
    }
  }

  if (organization) {
    const orgRecords = await getTrackedOrgs(db, organization, sender)
    if (orgRecords.length > 0) {
      await syncOrganizationMetadata(db, organization, orgRecords)
    }
  }

  if (issue && repoRecords.length > 0) {
    await ensureIssueTracking(db, issue, repoRecords)
  }

  if (pullRequest && repoRecords.length > 0) {
    await ensurePullRequestTracking(db, pullRequest, sender, payload, repoRecords, event)
  }

  log.info("Extended webhook processed", {
    event,
    action: toStringOrNull(payload.action),
    repository: toStringOrNull(repository?.full_name),
    organization: toStringOrNull(organization?.login),
  })
}
