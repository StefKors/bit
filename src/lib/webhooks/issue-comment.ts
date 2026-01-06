import type { WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook } from "./utils"
import { ensureIssueFromWebhook } from "./issue"

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
  const action = payload.action as string
  const comment = payload.comment as Record<string, unknown>
  const issue = payload.issue as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!comment || !issue || !repo) return

  // Skip if this is a PR comment (handled by comment.ts)
  if (issue.pull_request) {
    return
  }

  const repoFullName = repo.full_name as string
  const issueNodeId = issue.node_id as string

  // Find the issue in our database
  const issuesResult = await db.query({
    issues: {
      $: { where: { id: issueNodeId } },
    },
  })

  let issueRecords = issuesResult.issues || []

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
    if (repoRecords.length === 0 && sender) {
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
    console.log(`No users tracking issue ${repoFullName}#${issue.number as number}`)
    return
  }

  // Handle delete action
  if (action === "deleted") {
    const commentNodeId = comment.node_id as string
    await db.transact(db.tx.issueComments[commentNodeId].delete())
    console.log(`Deleted issue comment for ${repoFullName}#${issue.number as number}`)
    return
  }

  for (const issueRecord of issueRecords) {
    const now = Date.now()
    const commentId = comment.node_id as string
    const commentData = {
      id: commentId,
      githubId: comment.id as number,
      issueId: issueRecord.id,
      body: (comment.body as string) || null,
      authorLogin: ((comment.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((comment.user as Record<string, unknown>)?.avatar_url as string) || null,
      htmlUrl: comment.html_url as string,
      githubCreatedAt: new Date(comment.created_at as string).getTime(),
      githubUpdatedAt: new Date(comment.updated_at as string).getTime(),
      userId: issueRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.issueComments[commentId].update(commentData))
  }

  console.log(
    `Processed issue_comment.${action} for issue ${repoFullName}#${issue.number as number}`,
  )
}
