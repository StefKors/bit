import { eq, and } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, RepoRecord, PRRecord } from "./types"

/**
 * Find a user who has a GitHub account connected matching the webhook sender.
 * Used for auto-tracking repos when webhooks arrive from registered users.
 */
export async function findUserBySender(
  db: WebhookDB,
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

/**
 * Create or update a repo record from webhook payload data.
 * Used for auto-tracking repos when webhooks arrive.
 */
export async function ensureRepoFromWebhook(
  db: WebhookDB,
  repo: Record<string, unknown>,
  userId: string,
): Promise<RepoRecord | null> {
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

/**
 * Create or update a PR record from webhook payload data.
 * Used for auto-tracking PRs when review/comment webhooks arrive.
 */
export async function ensurePRFromWebhook(
  db: WebhookDB,
  pr: Record<string, unknown>,
  repoRecord: RepoRecord,
): Promise<PRRecord | null> {
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

