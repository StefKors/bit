import { id } from "@instantdb/admin"
import type {
  Issue,
  IssueRecord,
  IssuesEvent,
  RepoRecord,
  WebhookDB,
  WebhookPayload,
} from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

const parseGithubTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

const buildIssueData = (issue: Issue, repoId: string, userId: string, now: number) => ({
  githubId: issue.id,
  number: issue.number,
  repoId,
  title: issue.title,
  body: issue.body || null,
  state: issue.state,
  stateReason: issue.state_reason || null,
  authorLogin: issue.user?.login || null,
  authorAvatarUrl: issue.user?.avatar_url || null,
  htmlUrl: issue.html_url,
  comments: issue.comments ?? 0,
  labels: JSON.stringify(
    (issue.labels || []).map((label) => ({
      name: label.name,
      color: label.color,
    })),
  ),
  assignees: JSON.stringify(
    (issue.assignees || []).map((assignee) => ({
      login: assignee.login,
      avatar_url: assignee.avatar_url,
    })),
  ),
  milestone: issue.milestone
    ? JSON.stringify({
        title: issue.milestone.title,
        number: issue.milestone.number,
      })
    : null,
  githubCreatedAt: parseGithubTimestamp(issue.created_at),
  githubUpdatedAt: parseGithubTimestamp(issue.updated_at),
  closedAt: parseGithubTimestamp(issue.closed_at),
  userId,
  syncedAt: now,
  createdAt: now,
  updatedAt: now,
})

/**
 * Handle issues webhook events.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates issue for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo and issue
 * - If sender not registered → logs and skips
 */
export const handleIssueWebhook = async (db: WebhookDB, payload: WebhookPayload) => {
  const typedPayload = payload as IssuesEvent
  const { action, issue, repository: repo, sender } = typedPayload

  // Skip if this is a pull request (PRs show up as issues too)
  if (issue.pull_request) {
    console.log("Skipping issue webhook for pull request")
    return
  }

  const repoFullName = repo.full_name
  const githubId = issue.id

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const newRepo = await ensureRepoFromWebhook(db, repo, userId)
      if (newRepo) {
        repoRecords = [newRepo]
      }
    }
  }

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName} and sender not registered`)
    return
  }

  for (const repoRecord of repoRecords) {
    // Find existing issue by githubId to get its UUID, or generate new one
    const existingResult = await db.query({
      issues: {
        $: { where: { githubId }, limit: 1 },
      },
    })
    const issueId = existingResult.issues?.[0]?.id || id()

    const now = Date.now()
    const issueData = buildIssueData(issue, repoRecord.id, repoRecord.userId, now)

    await db.transact(db.tx.issues[issueId].update(issueData))
  }

  console.log(`Processed issues.${action} for ${repoFullName}#${issue.number}`)
}

/**
 * Create or update an issue record from webhook payload data.
 * Used for auto-tracking issues when comment webhooks arrive.
 */
export const ensureIssueFromWebhook = async (
  db: WebhookDB,
  issue: Issue | Record<string, unknown>,
  repoRecord: RepoRecord,
): Promise<IssueRecord | null> => {
  const typedIssue = issue as Issue
  const githubId = typedIssue.id

  // Check if issue already exists by githubId
  const existingResult = await db.query({
    issues: {
      $: { where: { githubId }, limit: 1 },
    },
  })

  const existing = existingResult.issues || []
  if (existing[0]) {
    return existing[0] as IssueRecord
  }

  // Generate a new UUID for this issue
  const issueId = id()

  const now = Date.now()
  const issueData = buildIssueData(typedIssue, repoRecord.id, repoRecord.userId, now)

  await db.transact(db.tx.issues[issueId].update(issueData))

  // Fetch the inserted record
  const insertedResult = await db.query({
    issues: {
      $: { where: { id: issueId }, limit: 1 },
    },
  })

  const inserted = insertedResult.issues || []
  console.log(`Auto-tracked issue #${typedIssue.number} for repo ${repoRecord.fullName}`)

  return (inserted[0] as IssueRecord) ?? null
}
