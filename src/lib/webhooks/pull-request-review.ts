import { id } from "@instantdb/admin"
import type { PullRequestReviewEvent, WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook, ensurePRFromWebhook } from "./utils"
import { log } from "@/lib/logger"

const parseGithubTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

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
  const typedPayload = payload as PullRequestReviewEvent
  const { review, pull_request: pr, repository: repo, sender } = typedPayload

  const prGithubId = pr.id
  const reviewGithubId = review.id
  const repoFullName = repo.full_name

  log.info("Webhook pull_request_review: updating entities", {
    op: "webhook-handler-pull-request-review",
    entity: "prReviews",
    repo: repoFullName,
    pr: pr.number,
    reviewId: reviewGithubId,
    state: review.state,
    dataToUpdate: "prReviews (state, body, author, submittedAt)",
  })

  // Find the PR in our database by githubId
  const prResult = await db.query({
    pullRequests: {
      $: { where: { githubId: prGithubId } },
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
    // Find existing review by githubId to get its UUID, or generate new one
    const existingReviewResult = await db.query({
      prReviews: {
        $: { where: { githubId: reviewGithubId }, limit: 1 },
      },
    })
    const reviewId = existingReviewResult.prReviews?.[0]?.id || id()

    const now = Date.now()
    const reviewData = {
      githubId: reviewGithubId,
      pullRequestId: prRecord.id,
      state: review.state,
      body: review.body || null,
      authorLogin: review.user?.login || null,
      authorAvatarUrl: review.user?.avatar_url || null,
      htmlUrl: review.html_url,
      submittedAt: parseGithubTimestamp(review.submitted_at),
      userId: prRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    await db.transact(db.tx.prReviews[reviewId].update(reviewData))
  }

  log.info("Webhook pull_request_review: processed", {
    op: "webhook-handler-pull-request-review",
    repo: repoFullName,
    pr: pr.number,
  })
}
