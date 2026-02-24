import { id } from "@instantdb/admin"
import type { IssueCommentEvent, WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"
import { ensureIssueFromWebhook } from "./issue"

const parseGithubTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Handle issue_comment webhook events for actual issues (not PRs).
 *
 * Auto-tracking behavior:
 * - If issue exists in database → adds comment to all tracked instances
 * - If issue not tracked but repo is → auto-creates issue and adds comment
 * - If repo not tracked but sender is registered → auto-creates repo, issue, and comment
 * - If sender not registered → logs and skips
 *
 * Note: issue_comment events are sent for both issues AND pull requests.
 * This handler only processes comments on actual issues (not PRs).
 * PR comments are handled by the comment.ts handler.
 */
export const handleIssueCommentWebhook = async (db: WebhookDB, payload: WebhookPayload) => {
  const typedPayload = payload as IssueCommentEvent
  const { action, comment, issue, repository: repo, sender } = typedPayload

  // Skip if this is a PR comment (handled by comment.ts)
  if (issue.pull_request) {
    return
  }

  const repoFullName = repo.full_name
  const issueGithubId = issue.id

  // Find the issue in our database by githubId
  const issuesResult = await db.query({
    issues: {
      $: { where: { githubId: issueGithubId } },
    },
  })

  const issueRecords = issuesResult.issues || []

  // If issue not found, try to auto-create it
  if (issueRecords.length === 0) {
    // First check if any user is tracking this repo
    const reposResult = await db.query({
      repos: {
        $: { where: { fullName: repoFullName } },
      },
    })

    let repoRecords = reposResult.repos || []

    // If no users tracking repo, try to auto-track for sender
    if (repoRecords.length === 0) {
      const userId = await findUserBySender(db, sender)
      if (userId) {
        const newRepo = await ensureRepoFromWebhook(db, repo, userId)
        if (newRepo) {
          repoRecords = [newRepo]
        }
      }
    }

    // Now create issues for all tracked repos
    for (const repoRecord of repoRecords) {
      const newIssue = await ensureIssueFromWebhook(db, issue, repoRecord)
      if (newIssue) {
        issueRecords.push(newIssue)
      }
    }
  }

  if (issueRecords.length === 0) {
    console.log(`No users tracking issue ${repoFullName}#${issue.number}`)
    return
  }

  // Handle delete action
  if (action === "deleted") {
    const commentGithubId = comment.id
    // Find existing comment by githubId
    const existingResult = await db.query({
      issueComments: {
        $: { where: { githubId: commentGithubId }, limit: 1 },
      },
    })
    const existingComment = existingResult.issueComments?.[0]
    if (existingComment) {
      await db.transact(db.tx.issueComments[existingComment.id].delete())
    }
    console.log(`Deleted issue comment for ${repoFullName}#${issue.number}`)
    return
  }

  for (const issueRecord of issueRecords) {
    const commentGithubId = comment.id

    // Find existing comment by githubId to get its UUID, or generate new one
    const existingResult = await db.query({
      issueComments: {
        $: { where: { githubId: commentGithubId }, limit: 1 },
      },
    })
    const commentId = existingResult.issueComments?.[0]?.id || id()

    const now = Date.now()
    const commentData = {
      githubId: commentGithubId,
      issueId: issueRecord.id,
      body: comment.body || null,
      authorLogin: comment.user?.login || null,
      authorAvatarUrl: comment.user?.avatar_url || null,
      htmlUrl: comment.html_url,
      githubCreatedAt: parseGithubTimestamp(comment.created_at),
      githubUpdatedAt: parseGithubTimestamp(comment.updated_at),
      userId: issueRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.issueComments[commentId].update(commentData))
  }

  console.log(`Processed issue_comment.${action} for issue ${repoFullName}#${issue.number}`)
}
