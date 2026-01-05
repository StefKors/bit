import { eq } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook, ensurePRFromWebhook } from "./utils"

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
  eventType: string,
) {
  const comment = payload.comment as Record<string, unknown>
  const pr = payload.pull_request as Record<string, unknown>
  const issue = payload.issue as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!comment || !repo) return

  // For issue_comment on PRs, check if it's a PR
  const prNodeId =
    (pr?.node_id as string) || ((issue?.pull_request ? issue.node_id : null) as string | null)
  if (!prNodeId) return

  const repoFullName = repo.full_name as string

  // Find the PR in our database
  const prRecords = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))

  // If PR not found and we have PR data, try to auto-create it
  if (prRecords.length === 0 && pr) {
    // First check if any user is tracking this repo
    const repoRecords = await db
      .select()
      .from(dbSchema.githubRepo)
      .where(eq(dbSchema.githubRepo.fullName, repoFullName))

    // If no users tracking repo, try to auto-track for sender
    if (repoRecords.length === 0 && sender) {
      const userId = await findUserBySender(db, sender)
      if (userId) {
        const newRepo = await ensureRepoFromWebhook(db, repo, userId)
        if (newRepo) {
          repoRecords.push(newRepo)
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
    const commentData = {
      id: comment.node_id as string,
      githubId: comment.id as number,
      pullRequestId: prRecord.id,
      reviewId: (comment.pull_request_review_id as string) || null,
      commentType: eventType === "pull_request_review_comment" ? "review_comment" : "issue_comment",
      body: (comment.body as string) || null,
      authorLogin: ((comment.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((comment.user as Record<string, unknown>)?.avatar_url as string) || null,
      htmlUrl: comment.html_url as string,
      path: (comment.path as string) || null,
      line: (comment.line as number) ?? (comment.original_line as number) ?? null,
      side: (comment.side as string) || null,
      diffHunk: (comment.diff_hunk as string) || null,
      githubCreatedAt: new Date(comment.created_at as string),
      githubUpdatedAt: new Date(comment.updated_at as string),
      userId: prRecord.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db
      .insert(dbSchema.githubPrComment)
      .values(commentData)
      .onConflictDoUpdate({
        target: dbSchema.githubPrComment.id,
        set: {
          body: commentData.body,
          githubUpdatedAt: commentData.githubUpdatedAt,
          updatedAt: new Date(),
        },
      })
  }

  console.log(`Processed ${eventType} for PR`)
}
