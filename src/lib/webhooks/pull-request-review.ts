import type { WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook, ensurePRFromWebhook } from "./utils"

/**
 * Handle pull_request_review webhook events.
 *
 * Auto-tracking behavior:
 * - If PR exists in database → adds review to all tracked instances
 * - If PR not tracked but repo is → auto-creates PR and adds review
 * - If repo not tracked but sender is registered → auto-creates repo, PR, and review
 * - If sender not registered → logs and skips
 */
export async function handlePullRequestReviewWebhook(db: WebhookDB, payload: WebhookPayload) {
  const review = payload.review as Record<string, unknown>
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!review || !pr || !repo) return

  const prNodeId = pr.node_id as string
  const reviewNodeId = review.node_id as string
  const repoFullName = repo.full_name as string

  // Find the PR in our database
  const prResult = await db.query({
    pullRequests: {
      $: { where: { id: prNodeId } },
    },
  })

  const prRecords = prResult.pullRequests || []

  // If PR not found, try to auto-create it if the repo is tracked or sender is registered
  if (prRecords.length === 0) {
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

    // Now create PRs for all tracked repos
    for (const repoRecord of repoRecords) {
      const newPr = await ensurePRFromWebhook(db, pr, repoRecord)
      if (newPr) {
        prRecords.push(newPr)
      }
    }
  }

  for (const prRecord of prRecords) {
    const now = Date.now()
    const reviewData = {
      id: reviewNodeId,
      githubId: review.id as number,
      pullRequestId: prRecord.id,
      state: review.state as string,
      body: (review.body as string) || null,
      authorLogin: ((review.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((review.user as Record<string, unknown>)?.avatar_url as string) || null,
      htmlUrl: review.html_url as string,
      submittedAt: review.submitted_at ? new Date(review.submitted_at as string).getTime() : null,
      userId: prRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.prReviews[reviewNodeId].update(reviewData))
  }

  console.log(`Processed pull_request_review for PR #${pr.number as number}`)
}
