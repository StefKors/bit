import { Hono } from "hono"
import type { Context } from "hono"
import { handle } from "hono/vercel"
import { Pool } from "pg"
import { createHmac, timingSafeEqual } from "crypto"
import { drizzle } from "drizzle-orm/node-postgres"
import { eq } from "drizzle-orm"
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero"
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server"
import { zeroNodePg } from "@rocicorp/zero/server/adapters/pg"
import { mutators } from "../src/db/mutators"
import { queries } from "../src/db/queries"
import { schema } from "../src/db/schema"
import type { AuthData } from "../src/db/types"
import { auth } from "./auth"
import { createGitHubClient } from "./github"
import * as dbSchema from "../schema"

export const config = {
  runtime: "nodejs",
}

export const app = new Hono().basePath("/api")

const pool = new Pool({
  connectionString: must(process.env.ZERO_UPSTREAM_DB),
})
const dbProvider = zeroNodePg(schema, pool)

const getContext = async (c: Context): Promise<AuthData> => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return { userID: null }
  }
  return { userID: session.user.id }
}

// Mount Better Auth handler for all /api/auth/* routes
app.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw)
})

app.post("/zero/query", async (c) => {
  const ctx = await getContext(c)
  const result = await handleQueryRequest(
    (name, args) => mustGetQuery(queries, name).fn({ args, ctx }),
    schema,
    c.req.raw,
  )
  return c.json(result)
})

app.post("/zero/mutate", async (c) => {
  const ctx = await getContext(c)
  const result = await handleMutateRequest(
    dbProvider,
    (transact) =>
      // @ts-expect-error - mutators is empty but Zero requires this endpoint
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      transact((tx, name, args) => mustGetMutator(mutators, name).fn({ tx, args, ctx })),
    c.req.raw,
  )
  return c.json(result)
})

// =============================================================================
// GitHub Sync Endpoints
// =============================================================================

// Helper to require authentication
const requireAuth = async (c: Context) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return null
  }
  return session
}

// Get current rate limit status
app.get("/github/rate-limit", async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const client = await createGitHubClient(session.user.id, pool)
  if (!client) {
    return c.json({ error: "GitHub account not connected" }, 400)
  }

  try {
    const rateLimit = await client.getRateLimit()
    return c.json({ rateLimit })
  } catch (error) {
    console.error("Error fetching rate limit:", error)
    return c.json({ error: "Failed to fetch rate limit" }, 500)
  }
})

// Sync overview (organizations and repositories)
app.post("/github/sync/overview", async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const client = await createGitHubClient(session.user.id, pool)
  if (!client) {
    return c.json({ error: "GitHub account not connected" }, 400)
  }

  try {
    // Fetch organizations
    const orgsResult = await client.fetchOrganizations()

    // Fetch repositories
    const reposResult = await client.fetchRepositories()

    return c.json({
      organizations: orgsResult.data.length,
      repositories: reposResult.data.length,
      rateLimit: reposResult.rateLimit,
    })
  } catch (error) {
    console.error("Error syncing overview:", error)
    return c.json(
      {
        error: "Failed to sync overview",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Sync pull requests for a specific repository
app.post("/github/sync/:owner/:repo", async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { owner, repo } = c.req.param()
  const state = (c.req.query("state") as "open" | "closed" | "all") || "all"

  const client = await createGitHubClient(session.user.id, pool)
  if (!client) {
    return c.json({ error: "GitHub account not connected" }, 400)
  }

  try {
    const result = await client.fetchPullRequests(owner, repo, state)

    return c.json({
      pullRequests: result.data.length,
      rateLimit: result.rateLimit,
    })
  } catch (error) {
    console.error("Error syncing pull requests:", error)
    return c.json(
      {
        error: "Failed to sync pull requests",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Sync detailed PR info (files, comments, reviews)
app.post("/github/sync/:owner/:repo/pull/:number", async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { owner, repo, number } = c.req.param()
  const pullNumber = parseInt(number, 10)

  if (isNaN(pullNumber)) {
    return c.json({ error: "Invalid pull request number" }, 400)
  }

  const client = await createGitHubClient(session.user.id, pool)
  if (!client) {
    return c.json({ error: "GitHub account not connected" }, 400)
  }

  try {
    const result = await client.fetchPullRequestDetails(owner, repo, pullNumber)

    return c.json({
      files: result.files.length,
      reviews: result.reviews.length,
      comments: result.comments.length,
      rateLimit: result.rateLimit,
    })
  } catch (error) {
    console.error("Error syncing PR details:", error)
    return c.json(
      {
        error: "Failed to sync PR details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// =============================================================================
// GitHub Webhook Handler
// =============================================================================

// Verify GitHub webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
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

// GitHub webhook endpoint
app.post("/github/webhook", async (c) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET not configured")
    return c.json({ error: "Webhook not configured" }, 500)
  }

  // Get raw body for signature verification
  const rawBody = await c.req.text()
  const signature = c.req.header("x-hub-signature-256") || ""

  // Verify signature
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error("Invalid webhook signature")
    return c.json({ error: "Invalid signature" }, 401)
  }

  const event = c.req.header("x-github-event")
  const delivery = c.req.header("x-github-delivery")

  console.log(`Received GitHub webhook: ${event} (${delivery})`)

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400)
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

    return c.json({ received: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return c.json({ error: "Failed to process webhook" }, 500)
  }
})

// Handle pull_request webhook events
async function handlePullRequestWebhook(
  db: ReturnType<typeof drizzle>,
  payload: Record<string, unknown>,
) {
  const action = payload.action as string
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>

  if (!pr || !repo) return

  const repoFullName = repo.full_name as string
  const prNodeId = pr.node_id as string

  // Find users who have this repo synced
  const repoRecords = await db
    .select()
    .from(dbSchema.githubRepo)
    .where(eq(dbSchema.githubRepo.fullName, repoFullName))

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName}`)
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

  if (!review || !pr || !repo) return

  const prNodeId = pr.node_id as string
  const reviewNodeId = review.node_id as string

  // Find the PR in our database
  const prRecords = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))

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

  if (!comment) return

  // For issue_comment on PRs, check if it's a PR
  const prNodeId =
    (pr?.node_id as string) || ((issue?.pull_request ? issue.node_id : null) as string | null)
  if (!prNodeId) return

  // Find the PR in our database
  const prRecords = await db
    .select()
    .from(dbSchema.githubPullRequest)
    .where(eq(dbSchema.githubPullRequest.id, prNodeId))

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

export default handle(app)

function must<T>(val: T) {
  if (!val) {
    throw new Error("Expected value to be defined")
  }
  return val
}
