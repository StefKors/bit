import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { createHmac, timingSafeEqual } from "crypto"
import { drizzle } from "drizzle-orm/node-postgres"
import { eq, and } from "drizzle-orm"
import * as dbSchema from "../../../../schema"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

// Verify GitHub webhook signature
const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  if (!signature) return false

  const sig = signature.replace("sha256=", "")
  const hmac = createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(digest))
  } catch {
    return false
  }
}

// Find a user who has a GitHub account connected matching the sender
async function findUserBySender(
  db: ReturnType<typeof drizzle>,
  sender: Record<string, unknown>,
): Promise<string | null> {
  const senderId = String(sender.id)

  const accounts = await db
    .select()
    .from(dbSchema.authAccount)
    .where(
      and(
        eq(dbSchema.authAccount.accountId, senderId),
        eq(dbSchema.authAccount.providerId, "github"),
      ),
    )
    .limit(1)

  return accounts[0]?.userId ?? null
}

// Create a repo record from webhook payload
async function ensureRepoFromWebhook(
  db: ReturnType<typeof drizzle>,
  repo: Record<string, unknown>,
  userId: string,
): Promise<typeof dbSchema.githubRepo.$inferSelect | null> {
  const nodeId = repo.node_id as string
  const fullName = repo.full_name as string

  // Check if repo already exists for this user
  const existing = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(and(eq(dbSchema.githubRepo.fullName, fullName), eq(dbSchema.githubRepo.userId, userId)))
    .limit(1)

  if (existing[0]) {
    return existing[0]
  }

  const owner = repo.owner as Record<string, unknown>

  const repoData = {
    id: nodeId,
    githubId: repo.id as number,
    name: repo.name as string,
    fullName,
    owner: owner.login as string,
    description: (repo.description as string) || null,
    url: repo.url as string,
    htmlUrl: repo.html_url as string,
    private: (repo.private as boolean) || false,
    fork: (repo.fork as boolean) || false,
    defaultBranch: (repo.default_branch as string) || "main",
    language: (repo.language as string) || null,
    stargazersCount: (repo.stargazers_count as number) || 0,
    forksCount: (repo.forks_count as number) || 0,
    openIssuesCount: (repo.open_issues_count as number) || 0,
    organizationId: null,
    userId,
    githubCreatedAt: repo.created_at ? new Date(repo.created_at as string) : null,
    githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at as string) : null,
    githubPushedAt: repo.pushed_at ? new Date(repo.pushed_at as string) : null,
    syncedAt: new Date(),
  }

  await db
    .insert(dbSchema.githubRepo)
    .values(repoData)
    .onConflictDoUpdate({
      target: dbSchema.githubRepo.id,
      set: {
        name: repoData.name,
        fullName: repoData.fullName,
        owner: repoData.owner,
        description: repoData.description,
        url: repoData.url,
        htmlUrl: repoData.htmlUrl,
        private: repoData.private,
        fork: repoData.fork,
        defaultBranch: repoData.defaultBranch,
        language: repoData.language,
        stargazersCount: repoData.stargazersCount,
        forksCount: repoData.forksCount,
        openIssuesCount: repoData.openIssuesCount,
        githubCreatedAt: repoData.githubCreatedAt,
        githubUpdatedAt: repoData.githubUpdatedAt,
        githubPushedAt: repoData.githubPushedAt,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    })

  const inserted = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(and(eq(dbSchema.githubRepo.fullName, fullName), eq(dbSchema.githubRepo.userId, userId)))
    .limit(1)

  console.log(`Auto-tracked repo ${fullName} for user ${userId}`)

  return inserted[0] ?? null
}

// Create a PR record from webhook payload
async function ensurePRFromWebhook(
  db: ReturnType<typeof drizzle>,
  pr: Record<string, unknown>,
  repoRecord: typeof dbSchema.githubRepo.$inferSelect,
): Promise<typeof dbSchema.githubPullRequest.$inferSelect | null> {
  const prNodeId = pr.node_id as string

  // Check if PR already exists
  const existing = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))
    .limit(1)

  if (existing[0]) {
    return existing[0]
  }

  const prData = {
    id: prNodeId,
    githubId: pr.id as number,
    number: pr.number as number,
    repoId: repoRecord.id,
    title: pr.title as string,
    body: (pr.body as string) || null,
    state: pr.state as string,
    draft: (pr.draft as boolean) || false,
    merged: (pr.merged as boolean) || false,
    mergeable: (pr.mergeable as boolean) ?? null,
    mergeableState: (pr.mergeable_state as string) || null,
    authorLogin: ((pr.user as Record<string, unknown>)?.login as string) || null,
    authorAvatarUrl: ((pr.user as Record<string, unknown>)?.avatar_url as string) || null,
    headRef: (pr.head as Record<string, unknown>)?.ref as string,
    headSha: (pr.head as Record<string, unknown>)?.sha as string,
    baseRef: (pr.base as Record<string, unknown>)?.ref as string,
    baseSha: (pr.base as Record<string, unknown>)?.sha as string,
    htmlUrl: pr.html_url as string,
    diffUrl: pr.diff_url as string,
    additions: (pr.additions as number) ?? 0,
    deletions: (pr.deletions as number) ?? 0,
    changedFiles: (pr.changed_files as number) ?? 0,
    commits: (pr.commits as number) ?? 0,
    comments: (pr.comments as number) ?? 0,
    reviewComments: (pr.review_comments as number) ?? 0,
    labels: JSON.stringify(
      ((pr.labels as Array<Record<string, unknown>>) || []).map((l) => ({
        name: l.name,
        color: l.color,
      })),
    ),
    githubCreatedAt: pr.created_at ? new Date(pr.created_at as string) : null,
    githubUpdatedAt: pr.updated_at ? new Date(pr.updated_at as string) : null,
    closedAt: pr.closed_at ? new Date(pr.closed_at as string) : null,
    mergedAt: pr.merged_at ? new Date(pr.merged_at as string) : null,
    userId: repoRecord.userId,
    syncedAt: new Date(),
  }

  await db
    .insert(dbSchema.githubPullRequest)
    .values(prData)
    .onConflictDoUpdate({
      target: dbSchema.githubPullRequest.id,
      set: {
        title: prData.title,
        body: prData.body,
        state: prData.state,
        draft: prData.draft,
        merged: prData.merged,
        mergeable: prData.mergeable,
        mergeableState: prData.mergeableState,
        headSha: prData.headSha,
        additions: prData.additions,
        deletions: prData.deletions,
        changedFiles: prData.changedFiles,
        commits: prData.commits,
        comments: prData.comments,
        reviewComments: prData.reviewComments,
        labels: prData.labels,
        githubUpdatedAt: prData.githubUpdatedAt,
        closedAt: prData.closedAt,
        mergedAt: prData.mergedAt,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    })

  const inserted = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))
    .limit(1)

  console.log(`Auto-tracked PR #${pr.number as number} for repo ${repoRecord.fullName}`)

  return inserted[0] ?? null
}

// Handle pull_request webhook events
async function handlePullRequestWebhook(
  db: ReturnType<typeof drizzle>,
  payload: Record<string, unknown>,
) {
  const action = payload.action as string
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!pr || !repo) return

  const repoFullName = repo.full_name as string
  const prNodeId = pr.node_id as string

  // Find users who have this repo synced
  let repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

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
    const prData = {
      id: prNodeId,
      githubId: pr.id as number,
      number: pr.number as number,
      repoId: repoRecord.id,
      title: pr.title as string,
      body: (pr.body as string) || null,
      state: pr.state as string,
      draft: (pr.draft as boolean) || false,
      merged: (pr.merged as boolean) || false,
      mergeable: (pr.mergeable as boolean) ?? null,
      mergeableState: (pr.mergeable_state as string) || null,
      authorLogin: ((pr.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((pr.user as Record<string, unknown>)?.avatar_url as string) || null,
      headRef: (pr.head as Record<string, unknown>)?.ref as string,
      headSha: (pr.head as Record<string, unknown>)?.sha as string,
      baseRef: (pr.base as Record<string, unknown>)?.ref as string,
      baseSha: (pr.base as Record<string, unknown>)?.sha as string,
      htmlUrl: pr.html_url as string,
      diffUrl: pr.diff_url as string,
      additions: (pr.additions as number) ?? 0,
      deletions: (pr.deletions as number) ?? 0,
      changedFiles: (pr.changed_files as number) ?? 0,
      commits: (pr.commits as number) ?? 0,
      comments: (pr.comments as number) ?? 0,
      reviewComments: (pr.review_comments as number) ?? 0,
      labels: JSON.stringify(
        ((pr.labels as Array<Record<string, unknown>>) || []).map((l) => ({
          name: l.name,
          color: l.color,
        })),
      ),
      githubCreatedAt: new Date(pr.created_at as string),
      githubUpdatedAt: new Date(pr.updated_at as string),
      closedAt: pr.closed_at ? new Date(pr.closed_at as string) : null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at as string) : null,
      userId: repoRecord.userId,
      syncedAt: new Date(),
    }

    if (action === "closed" && pr.merged) {
      prData.merged = true
      prData.mergedAt = pr.merged_at ? new Date(pr.merged_at as string) : new Date()
    }

    await db
      .insert(dbSchema.githubPullRequest)
      .values(prData)
      .onConflictDoUpdate({
        target: dbSchema.githubPullRequest.id,
        set: {
          title: prData.title,
          body: prData.body,
          state: prData.state,
          draft: prData.draft,
          merged: prData.merged,
          mergeable: prData.mergeable,
          mergeableState: prData.mergeableState,
          headSha: prData.headSha,
          additions: prData.additions,
          deletions: prData.deletions,
          changedFiles: prData.changedFiles,
          commits: prData.commits,
          comments: prData.comments,
          reviewComments: prData.reviewComments,
          labels: prData.labels,
          githubUpdatedAt: prData.githubUpdatedAt,
          closedAt: prData.closedAt,
          mergedAt: prData.mergedAt,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      })
  }

  console.log(`Processed pull_request.${action} for ${repoFullName}#${pr.number as number}`)
}

// Handle pull_request_review webhook events
async function handlePullRequestReviewWebhook(
  db: ReturnType<typeof drizzle>,
  payload: Record<string, unknown>,
) {
  const review = payload.review as Record<string, unknown>
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!review || !pr || !repo) return

  const prNodeId = pr.node_id as string
  const reviewNodeId = review.node_id as string
  const repoFullName = repo.full_name as string

  // Find the PR in our database
  const prRecords = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))

  // If PR not found, try to auto-create it if the repo is tracked or sender is registered
  if (prRecords.length === 0) {
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
    const reviewData = {
      id: reviewNodeId,
      githubId: review.id as number,
      pullRequestId: prRecord.id,
      state: review.state as string,
      body: (review.body as string) || null,
      authorLogin: ((review.user as Record<string, unknown>)?.login as string) || null,
      authorAvatarUrl: ((review.user as Record<string, unknown>)?.avatar_url as string) || null,
      htmlUrl: review.html_url as string,
      submittedAt: review.submitted_at ? new Date(review.submitted_at as string) : null,
      userId: prRecord.userId,
    }

    await db
      .insert(dbSchema.githubPrReview)
      .values(reviewData)
      .onConflictDoUpdate({
        target: dbSchema.githubPrReview.id,
        set: {
          state: reviewData.state,
          body: reviewData.body,
          submittedAt: reviewData.submittedAt,
          updatedAt: new Date(),
        },
      })
  }

  console.log(`Processed pull_request_review for PR #${pr.number as number}`)
}

// Handle comment webhook events
async function handleCommentWebhook(
  db: ReturnType<typeof drizzle>,
  payload: Record<string, unknown>,
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

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

        if (!webhookSecret) {
          console.error("GITHUB_WEBHOOK_SECRET not configured")
          return jsonResponse({ error: "Webhook not configured" }, 500)
        }

        // Get raw body for signature verification
        const rawBody = await request.text()
        const signature = request.headers.get("x-hub-signature-256") || ""

        // Verify signature
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          console.error("Invalid webhook signature")
          return jsonResponse({ error: "Invalid signature" }, 401)
        }

        const event = request.headers.get("x-github-event")
        const delivery = request.headers.get("x-github-delivery")

        console.log(`Received GitHub webhook: ${event} (${delivery})`)

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400)
        }

        const db = drizzle(pool, { schema: dbSchema })

        try {
          switch (event) {
            case "pull_request": {
              await handlePullRequestWebhook(db, payload)
              break
            }
            case "pull_request_review": {
              await handlePullRequestReviewWebhook(db, payload)
              break
            }
            case "pull_request_review_comment":
            case "issue_comment": {
              await handleCommentWebhook(db, payload, event)
              break
            }
            case "ping": {
              console.log("Received ping webhook")
              break
            }
            default: {
              console.log(`Unhandled webhook event: ${event}`)
            }
          }

          return jsonResponse({ received: true })
        } catch (error) {
          console.error("Error processing webhook:", error)
          return jsonResponse({ error: "Failed to process webhook" }, 500)
        }
      },
    },
  },
})
