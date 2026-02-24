import { id } from "@instantdb/admin"
import type { PullRequest, RepoRecord, Repository, PRRecord, User, WebhookDB } from "./types"

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toRecord = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null)

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const toBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null

const parseGithubTimestamp = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    // GitHub occasionally uses unix seconds in some payloads.
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (typeof value !== "string" || value.length === 0) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Find a user who has a GitHub account connected matching the webhook sender.
 * Looks up the $users table by githubId to enable auto-tracking of repos
 * when webhooks arrive from registered users.
 */
export async function findUserBySender(
  db: WebhookDB,
  sender: Pick<User, "id"> | { id?: unknown },
): Promise<string | null> {
  const senderGithubId = toNumberOrNull((sender as UnknownRecord).id)
  if (!senderGithubId) {
    console.log("findUserBySender: No sender ID in webhook payload")
    return null
  }

  const result = await db.query({
    $users: {
      $: { where: { githubId: senderGithubId }, limit: 1 },
    },
  })

  const users = result.$users || []
  if (users[0]) {
    return users[0].id
  }

  console.log(`findUserBySender: No registered user for GitHub ID ${senderGithubId}`)
  return null
}

/**
 * Create or update a repo record from webhook payload data.
 * Used for auto-tracking repos when webhooks arrive.
 */
export async function ensureRepoFromWebhook(
  db: WebhookDB,
  repo: Repository | object,
  userId: string,
): Promise<RepoRecord | null> {
  const rawRepo = repo as UnknownRecord
  const githubId = toNumberOrNull(rawRepo.id)
  const fullName = toStringOrNull(rawRepo.full_name)
  const name = toStringOrNull(rawRepo.name)
  const ownerLogin = toStringOrNull(toRecord(rawRepo.owner)?.login)

  if (!githubId || !fullName || !name || !ownerLogin) {
    console.log("ensureRepoFromWebhook: Missing required repository fields", {
      hasGithubId: Boolean(githubId),
      hasFullName: Boolean(fullName),
      hasName: Boolean(name),
      hasOwnerLogin: Boolean(ownerLogin),
    })
    return null
  }

  // Check if repo already exists for this user by githubId
  const existingResult = await db.query({
    repos: {
      $: { where: { githubId }, limit: 1 },
    },
  })

  const existing = existingResult.repos || []
  if (existing[0]) {
    return existing[0] as RepoRecord
  }

  // Generate a new UUID for this repo
  const repoId = id()

  const now = Date.now()

  const repoData = {
    githubId,
    name,
    fullName,
    owner: ownerLogin,
    description: toStringOrNull(rawRepo.description),
    url: toStringOrNull(rawRepo.url) || undefined,
    htmlUrl: toStringOrNull(rawRepo.html_url) || undefined,
    private: toBooleanOrNull(rawRepo.private) ?? false,
    fork: toBooleanOrNull(rawRepo.fork) ?? false,
    defaultBranch: toStringOrNull(rawRepo.default_branch) || "main",
    language: toStringOrNull(rawRepo.language),
    stargazersCount: toNumberOrNull(rawRepo.stargazers_count) ?? 0,
    forksCount: toNumberOrNull(rawRepo.forks_count) ?? 0,
    openIssuesCount: toNumberOrNull(rawRepo.open_issues_count) ?? 0,
    organizationId: null,
    userId,
    githubCreatedAt: parseGithubTimestamp(rawRepo.created_at),
    githubUpdatedAt: parseGithubTimestamp(rawRepo.updated_at),
    githubPushedAt: parseGithubTimestamp(rawRepo.pushed_at),
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.transact(db.tx.repos[repoId].update(repoData))

  // Fetch the inserted record
  const insertedResult = await db.query({
    repos: {
      $: { where: { id: repoId }, limit: 1 },
    },
  })

  const inserted = insertedResult.repos || []
  console.log(`Auto-tracked repo ${fullName} for user ${userId}`)

  return (inserted[0] as RepoRecord) ?? null
}

/**
 * Create or update a PR record from webhook payload data.
 * Used for auto-tracking PRs when review/comment webhooks arrive.
 */
export async function ensurePRFromWebhook(
  db: WebhookDB,
  pr: PullRequest | object,
  repoRecord: RepoRecord,
): Promise<PRRecord | null> {
  const rawPr = pr as UnknownRecord
  const githubId = toNumberOrNull(rawPr.id)
  const prNumber = toNumberOrNull(rawPr.number)
  const title = toStringOrNull(rawPr.title)
  const state = toStringOrNull(rawPr.state)

  if (!githubId || !prNumber || !title || !state) {
    console.log("ensurePRFromWebhook: Missing required pull request fields", {
      hasGithubId: Boolean(githubId),
      hasNumber: Boolean(prNumber),
      hasTitle: Boolean(title),
      hasState: Boolean(state),
    })
    return null
  }

  const author = toRecord(rawPr.user)
  const head = toRecord(rawPr.head)
  const base = toRecord(rawPr.base)
  const labelsRaw = Array.isArray(rawPr.labels) ? rawPr.labels : []
  const labels = labelsRaw
    .map((label) => {
      const labelRecord = toRecord(label)
      const name = toStringOrNull(labelRecord?.name)
      if (!name) return null
      return {
        name,
        color: toStringOrNull(labelRecord?.color),
      }
    })
    .filter((label): label is { name: string; color: string | null } => label !== null)

  // Check if PR already exists by githubId
  const existingResult = await db.query({
    pullRequests: {
      $: { where: { githubId }, limit: 1 },
    },
  })

  const existing = existingResult.pullRequests || []
  if (existing[0]) {
    return existing[0] as PRRecord
  }

  // Generate a new UUID for this PR
  const prId = id()

  const now = Date.now()
  const prData = {
    githubId,
    number: prNumber,
    repoId: repoRecord.id,
    title,
    body: toStringOrNull(rawPr.body),
    state,
    draft: toBooleanOrNull(rawPr.draft) ?? false,
    merged: toBooleanOrNull(rawPr.merged) ?? false,
    mergeable: toBooleanOrNull(rawPr.mergeable),
    mergeableState: toStringOrNull(rawPr.mergeable_state),
    authorLogin: toStringOrNull(author?.login),
    authorAvatarUrl: toStringOrNull(author?.avatar_url),
    headRef: toStringOrNull(head?.ref) || undefined,
    headSha: toStringOrNull(head?.sha) || undefined,
    baseRef: toStringOrNull(base?.ref) || undefined,
    baseSha: toStringOrNull(base?.sha) || undefined,
    htmlUrl: toStringOrNull(rawPr.html_url) || undefined,
    diffUrl: toStringOrNull(rawPr.diff_url) || undefined,
    additions: toNumberOrNull(rawPr.additions) ?? 0,
    deletions: toNumberOrNull(rawPr.deletions) ?? 0,
    changedFiles: toNumberOrNull(rawPr.changed_files) ?? 0,
    commits: toNumberOrNull(rawPr.commits) ?? 0,
    comments: toNumberOrNull(rawPr.comments) ?? 0,
    reviewComments: toNumberOrNull(rawPr.review_comments) ?? 0,
    labels: JSON.stringify(labels),
    githubCreatedAt: parseGithubTimestamp(rawPr.created_at),
    githubUpdatedAt: parseGithubTimestamp(rawPr.updated_at),
    closedAt: parseGithubTimestamp(rawPr.closed_at),
    mergedAt: parseGithubTimestamp(rawPr.merged_at),
    userId: repoRecord.userId,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.transact(db.tx.pullRequests[prId].update(prData))

  // Fetch the inserted record
  const insertedResult = await db.query({
    pullRequests: {
      $: { where: { id: prId }, limit: 1 },
    },
  })

  const inserted = insertedResult.pullRequests || []
  console.log(`Auto-tracked PR #${prNumber} for repo ${repoRecord.fullName}`)

  return (inserted[0] as PRRecord) ?? null
}
