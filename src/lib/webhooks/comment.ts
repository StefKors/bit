import { id } from "@instantdb/admin"
import type {
  IssueCommentEvent,
  PullRequestReviewCommentEvent,
  WebhookDB,
  WebhookPayload,
} from "./types"
import { findUserBySender, ensureRepoFromWebhook, ensurePRFromWebhook } from "./utils"

const parseGithubTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Handle comment webhook events (issue_comment and pull_request_review_comment).
 *
 * Auto-tracking behavior:
 * - If PR exists in database → adds comment to all tracked instances
 * - If PR not tracked but repo is → auto-creates PR and adds comment
 * - If repo not tracked but sender is registered → auto-creates repo, PR, and comment
 * - If sender not registered → logs and skips
 */
export async function handleCommentWebhook(
  db: WebhookDB,
  payload: WebhookPayload,
  eventType: "issue_comment" | "pull_request_review_comment",
) {
  const typedPayload = payload as IssueCommentEvent | PullRequestReviewCommentEvent
  const issueCommentPayload = typedPayload as IssueCommentEvent
  const reviewCommentPayload = typedPayload as PullRequestReviewCommentEvent
  const isReviewCommentEvent = eventType === "pull_request_review_comment"
  const repo = typedPayload.repository
  const sender = typedPayload.sender

  const comment = isReviewCommentEvent ? reviewCommentPayload.comment : issueCommentPayload.comment
  const reviewComment = isReviewCommentEvent ? reviewCommentPayload.comment : null
  const pr = isReviewCommentEvent ? reviewCommentPayload.pull_request : null
  const issue = !isReviewCommentEvent ? issueCommentPayload.issue : undefined

  // For issue_comment on PRs, get the PR github ID
  // pr.id is available for pull_request_review_comment
  // For issue_comment on PRs, issue.id is used (PRs are also issues)
  const prGithubId = pr?.id || (issue?.pull_request ? issue.id : null)
  if (!prGithubId) return

  const repoFullName = repo.full_name

  // Find the PR in our database by number (more reliable than githubId for issue_comments)
  const prNumber = pr?.number || issue?.number || 0
  const prResult = await db.query({
    pullRequests: {
      $: { where: { githubId: prGithubId } },
    },
  })

  const prRecords = prResult.pullRequests || []

  // If PR not found and we have PR data, try to auto-create it
  if (prRecords.length === 0 && pr) {
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

    // Now create PRs for all tracked repos
    for (const repoRecord of repoRecords) {
      const newPr = await ensurePRFromWebhook(db, pr, repoRecord)
      if (newPr) {
        prRecords.push(newPr)
      }
    }
  }

  for (const prRecord of prRecords) {
    const commentGithubId = comment.id

    // Find existing comment by githubId to get its UUID, or generate new one
    const existingCommentResult = await db.query({
      prComments: {
        $: { where: { githubId: commentGithubId }, limit: 1 },
      },
    })
    const commentId = existingCommentResult.prComments?.[0]?.id || id()

    const now = Date.now()
    const commentData = {
      githubId: commentGithubId,
      pullRequestId: prRecord.id,
      reviewId: reviewComment ? String(reviewComment.pull_request_review_id || "") || null : null,
      commentType: isReviewCommentEvent ? "review_comment" : "issue_comment",
      body: comment.body || null,
      authorLogin: comment.user?.login || null,
      authorAvatarUrl: comment.user?.avatar_url || null,
      htmlUrl: comment.html_url,
      path: reviewComment?.path || null,
      line: reviewComment?.line ?? reviewComment?.original_line ?? null,
      side: reviewComment?.side || null,
      diffHunk: reviewComment?.diff_hunk || null,
      githubCreatedAt: parseGithubTimestamp(comment.created_at),
      githubUpdatedAt: parseGithubTimestamp(comment.updated_at),
      userId: prRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.prComments[commentId].update(commentData))
  }

  console.log(`Processed ${eventType} for PR #${prNumber}`)
}
