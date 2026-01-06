import type { WebhookDB, WebhookPayload, RepoRecord, IssueRecord } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"

/**
 * Handle issues webhook events.
 *
 * Auto-tracking behavior:
 * - If repo is already tracked by users → updates issue for all tracking users
 * - If repo not tracked but sender is registered → auto-creates repo and issue
 * - If sender not registered → logs and skips
 */
export const handleIssueWebhook = async (db: WebhookDB, payload: WebhookPayload) => {
  const action = payload.action as string
  const issue = payload.issue as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!issue || !repo) return

  // Skip if this is a pull request (PRs show up as issues too)
  if (issue.pull_request) {
    console.log("Skipping issue webhook for pull request")
    return
  }

  const repoFullName = repo.full_name as string
  const issueNodeId = issue.node_id as string

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0 && sender) {
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
    const now = Date.now()
    const issueData = {
      id: issueNodeId,
      githubId: issue.id as number,
      number: issue.number as number,
      repoId: repoRecord.id,
      title: issue.title as string,
      body: (issue.body as string) || null,
      state: issue.state as string,
      stateReason: (issue.state_reason as string) || null,
      authorLogin: ((issue.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((issue.user as Record<string, unknown>)?.avatar_url as string) || null,
      htmlUrl: issue.html_url as string,
      comments: (issue.comments as number) ?? 0,
      labels: JSON.stringify(
        ((issue.labels as Array<Record<string, unknown>>) || []).map((l) => ({
          name: l.name,
          color: l.color,
        })),
      ),
      assignees: JSON.stringify(
        ((issue.assignees as Array<Record<string, unknown>>) || []).map((a) => ({
          login: a.login,
          avatar_url: a.avatar_url,
        })),
      ),
      milestone: issue.milestone
        ? JSON.stringify({
            title: (issue.milestone as Record<string, unknown>).title,
            number: (issue.milestone as Record<string, unknown>).number,
          })
        : null,
      githubCreatedAt: new Date(issue.created_at as string).getTime(),
      githubUpdatedAt: new Date(issue.updated_at as string).getTime(),
      closedAt: issue.closed_at ? new Date(issue.closed_at as string).getTime() : null,
      userId: repoRecord.userId,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.issues[issueNodeId].update(issueData))
  }

  console.log(`Processed issues.${action} for ${repoFullName}#${issue.number as number}`)
}

/**
 * Create or update an issue record from webhook payload data.
 * Used for auto-tracking issues when comment webhooks arrive.
 */
export const ensureIssueFromWebhook = async (
  db: WebhookDB,
  issue: Record<string, unknown>,
  repoRecord: RepoRecord,
): Promise<IssueRecord | null> => {
  const issueNodeId = issue.node_id as string

  // Check if issue already exists
  const existingResult = await db.query({
    issues: {
      $: { where: { id: issueNodeId }, limit: 1 },
    },
  })

  const existing = existingResult.issues || []
  if (existing[0]) {
    return existing[0] as IssueRecord
  }

  const now = Date.now()
  const issueData = {
    id: issueNodeId,
    githubId: issue.id as number,
    number: issue.number as number,
    repoId: repoRecord.id,
    title: issue.title as string,
    body: (issue.body as string) || null,
    state: issue.state as string,
    stateReason: (issue.state_reason as string) || null,
    authorLogin: ((issue.user as Record<string, unknown>)?.login as string) || null,
    authorAvatarUrl: ((issue.user as Record<string, unknown>)?.avatar_url as string) || null,
    htmlUrl: issue.html_url as string,
    comments: (issue.comments as number) ?? 0,
    labels: JSON.stringify(
      ((issue.labels as Array<Record<string, unknown>>) || []).map((l) => ({
        name: l.name,
        color: l.color,
      })),
    ),
    assignees: JSON.stringify(
      ((issue.assignees as Array<Record<string, unknown>>) || []).map((a) => ({
        login: a.login,
        avatar_url: a.avatar_url,
      })),
    ),
    milestone: issue.milestone
      ? JSON.stringify({
          title: (issue.milestone as Record<string, unknown>).title,
          number: (issue.milestone as Record<string, unknown>).number,
        })
      : null,
    githubCreatedAt: issue.created_at ? new Date(issue.created_at as string).getTime() : null,
    githubUpdatedAt: issue.updated_at ? new Date(issue.updated_at as string).getTime() : null,
    closedAt: issue.closed_at ? new Date(issue.closed_at as string).getTime() : null,
    userId: repoRecord.userId,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.transact(db.tx.issues[issueNodeId].update(issueData))

  // Fetch the inserted record
  const insertedResult = await db.query({
    issues: {
      $: { where: { id: issueNodeId }, limit: 1 },
    },
  })

  const inserted = insertedResult.issues || []
  console.log(`Auto-tracked issue #${issue.number as number} for repo ${repoRecord.fullName}`)

  return (inserted[0] as IssueRecord) ?? null
}
