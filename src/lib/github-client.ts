import { Octokit, RequestError } from "octokit"
import { id } from "@instantdb/admin"
import { adminDb } from "./instantAdmin"
import { findOrCreateSyncStateId } from "./sync-state"
import { buildTreeEntries, computeStaleEntries, type GitHubTreeItem } from "./sync-trees"
import { buildCommitEntries, computeStaleCommits, type GitHubCommit } from "./sync-commits"
import { log } from "./logger"
import { deterministicId } from "./deterministic-id"
import { getWebhookRegistrationConfig } from "./github-webhook-config"
import {
  chunkItems,
  mapWithConcurrency,
  selectReposForPullSync,
  type RepoActivitySnapshot,
} from "./sync-ingest"
import {
  SYNC_FRESHNESS_MS,
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_BASE_DELAY_MS,
  TRANSACT_CHUNK_SIZE,
  WEBHOOK_REGISTRATION_CONCURRENCY,
  INITIAL_SYNC_PR_CONCURRENCY,
} from "./sync-config"

export interface RateLimitInfo {
  remaining: number
  limit: number
  reset: Date
  used: number
}

export interface SyncResult<T> {
  data: T
  rateLimit: RateLimitInfo
  fromCache: boolean
}

export interface PullRequestDashboardItem {
  id: string
  repoFullName: string
  number: number
  title: string
  state: "open" | "closed"
  draft: boolean
  merged: boolean
  authorLogin: string | null
  authorAvatarUrl: string | null
  comments: number
  reviewComments: number
  htmlUrl: string | null
  githubCreatedAt: Date | null
  githubUpdatedAt: Date | null
}

interface RepositorySyncItem extends RepoActivitySnapshot {
  githubId: number
}

export function isGitHubAuthError(error: unknown): boolean {
  return error instanceof RequestError && error.status === 401
}

export async function handleGitHubAuthError(userId: string): Promise<void> {
  const { syncStates } = await adminDb.query({
    syncStates: {
      $: { where: { resourceType: "github:token", userId } },
    },
  })
  const tokenState = syncStates?.[0]
  if (tokenState) {
    await adminDb.transact(
      adminDb.tx.syncStates[tokenState.id].update({
        syncStatus: "auth_invalid",
        syncError: "GitHub token is no longer valid",
        updatedAt: Date.now(),
      }),
    )
  }
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof RequestError)) return false
  if (error.status === 429) return true
  if (error.status === 403) {
    const remaining = error.response?.headers?.["x-ratelimit-remaining"]
    return remaining === "0"
  }
  return false
}

function getRateLimitRetryDelay(error: RequestError): number {
  const headers = error.response?.headers
  if (!headers) return RATE_LIMIT_BASE_DELAY_MS

  const retryAfter = headers["retry-after"]
  if (retryAfter) return parseInt(String(retryAfter), 10) * 1000

  const resetTime = headers["x-ratelimit-reset"]
  if (resetTime) {
    const resetMs = parseInt(String(resetTime), 10) * 1000
    const delay = resetMs - Date.now()
    if (delay > 0) return Math.min(delay, 60_000)
  }

  return RATE_LIMIT_BASE_DELAY_MS
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRateLimitError(error) || attempt === RATE_LIMIT_MAX_RETRIES - 1) {
        throw error
      }
      const delay =
        getRateLimitRetryDelay(error as RequestError) * Math.pow(2, attempt) + Math.random() * 1000
      log.warn("Rate limited, retrying", { delayMs: Math.round(delay), attempt: attempt + 1 })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error("Unreachable")
}

// GitHub API client with rate limit tracking
export class GitHubClient {
  private octokit: Octokit
  private userId: string
  private lastRateLimit: RateLimitInfo | null = null

  constructor(accessToken: string, userId: string) {
    this.octokit = new Octokit({ auth: accessToken })
    this.userId = userId
  }

  // Extract rate limit info from response headers
  private extractRateLimit(headers: Record<string, string | undefined>): RateLimitInfo {
    const rateLimit: RateLimitInfo = {
      remaining: parseInt(headers["x-ratelimit-remaining"] || "5000", 10),
      limit: parseInt(headers["x-ratelimit-limit"] || "5000", 10),
      reset: new Date(parseInt(headers["x-ratelimit-reset"] || "0", 10) * 1000),
      used: parseInt(headers["x-ratelimit-used"] || "0", 10),
    }
    this.lastRateLimit = rateLimit
    return rateLimit
  }

  // Get current rate limit status
  async getRateLimit(): Promise<RateLimitInfo> {
    const response = await this.octokit.rest.rateLimit.get()
    return {
      remaining: response.data.rate.remaining,
      limit: response.data.rate.limit,
      reset: new Date(response.data.rate.reset * 1000),
      used: response.data.rate.used,
    }
  }

  // Check what OAuth scopes the token has
  async getTokenScopes(): Promise<string[]> {
    // Make a simple API call and check the x-oauth-scopes header
    const response = await this.octokit.rest.users.getAuthenticated()
    const scopes = response.headers["x-oauth-scopes"]
    if (typeof scopes === "string") {
      return scopes.split(",").map((s) => s.trim())
    }
    return []
  }

  // Update sync state in database
  async updateSyncState(
    resourceType: string,
    resourceId: string | null,
    rateLimit: RateLimitInfo,
    status: "idle" | "syncing" | "error" = "idle",
    error?: string,
    etag?: string,
  ) {
    const stateId = await findOrCreateSyncStateId(
      resourceType,
      this.userId,
      resourceId ?? undefined,
    )
    const now = Date.now()

    await adminDb.transact(
      adminDb.tx.syncStates[stateId]
        .update({
          resourceType,
          resourceId: resourceId ?? undefined,
          lastSyncedAt: now,
          lastEtag: etag ?? undefined,
          rateLimitRemaining: rateLimit.remaining,
          rateLimitReset: rateLimit.reset.getTime(),
          syncStatus: status,
          syncError: error ?? undefined,
          userId: this.userId,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId }),
    )
  }

  private async ensureRepoRecord(owner: string, repo: string) {
    const fullName = `${owner}/${repo}`

    // Check if repo already exists
    const { repos: existingRepos } = await adminDb.query({
      repos: {
        $: { where: { fullName } },
      },
    })

    if (existingRepos && existingRepos.length > 0) {
      return existingRepos[0]
    }

    // Fetch from GitHub
    const response = await this.octokit.rest.repos.get({ owner, repo })
    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const repoData = response.data
    const now = Date.now()

    const newRepoId = id()
    await adminDb.transact(
      adminDb.tx.repos[newRepoId]
        .update({
          githubId: repoData.id,
          name: repoData.name,
          fullName: repoData.full_name,
          owner: repoData.owner.login,
          description: repoData.description || undefined,
          url: repoData.url,
          htmlUrl: repoData.html_url,
          private: repoData.private,
          fork: repoData.fork,
          defaultBranch: repoData.default_branch || "main",
          language: repoData.language || undefined,
          stargazersCount: repoData.stargazers_count,
          forksCount: repoData.forks_count,
          openIssuesCount: repoData.open_issues_count,
          githubCreatedAt: repoData.created_at
            ? new Date(repoData.created_at).getTime()
            : undefined,
          githubUpdatedAt: repoData.updated_at
            ? new Date(repoData.updated_at).getTime()
            : undefined,
          githubPushedAt: repoData.pushed_at ? new Date(repoData.pushed_at).getTime() : undefined,
          userId: this.userId, // Required attribute
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId }),
    )

    await this.updateSyncState("repo", fullName, rateLimit)

    // Return with default branch and ID for downstream use
    return {
      ...repoData,
      id: newRepoId,
      defaultBranch: repoData.default_branch || "main",
    }
  }

  // Fetch user's organizations (with pagination)
  async fetchOrganizations(): Promise<SyncResult<{ githubId: number; login: string }[]>> {
    const allOrgsData = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.orgs.listForAuthenticatedUser, { per_page: 100 }),
    )

    // Get rate limit from a simple request (paginate doesn't expose headers easily)
    const rateLimit = await this.getRateLimit()

    const now = Date.now()
    const orgs = allOrgsData.map((org) => ({
      githubId: org.id,
      login: org.login,
      name: org.login,
      description: org.description || undefined,
      avatarUrl: org.avatar_url,
      url: org.url,
    }))

    const orgIds = orgs.map((org) => org.githubId)
    const existingByGithubId = new Map<number, { id: string; createdAt?: number }>()
    if (orgIds.length > 0) {
      const { organizations: existingOrganizations } = await adminDb.query({
        organizations: {
          $: { where: { githubId: { $in: orgIds } } },
        },
      })

      for (const existingOrg of existingOrganizations || []) {
        existingByGithubId.set(existingOrg.githubId, {
          id: existingOrg.id,
          createdAt: existingOrg.createdAt,
        })
      }
    }

    const orgTxs = orgs.map((org) => {
      const existingOrg = existingByGithubId.get(org.githubId)
      const orgId = existingOrg?.id || id()

      return adminDb.tx.organizations[orgId]
        .update({
          githubId: org.githubId,
          login: org.login,
          name: org.name,
          description: org.description,
          avatarUrl: org.avatarUrl,
          url: org.url,
          syncedAt: now,
          createdAt: existingOrg?.createdAt ?? now,
          updatedAt: now,
        })
        .link({ user: this.userId })
    })

    for (const txChunk of chunkItems(orgTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    await this.updateSyncState("orgs", null, rateLimit)

    return { data: orgs, rateLimit, fromCache: false }
  }

  // Fetch user's repositories (personal and org repos) with pagination
  async fetchRepositories(): Promise<SyncResult<RepositorySyncItem[]>> {
    const allReposData = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.repos.listForAuthenticatedUser, {
        per_page: 100,
        sort: "updated",
        affiliation: "owner,collaborator,organization_member",
      }),
    )

    // Get rate limit from a simple request
    const rateLimit = await this.getRateLimit()

    const now = Date.now()
    const repos = allReposData.map((repo) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      ownerType: repo.owner.type, // "User" or "Organization"
      description: repo.description || undefined,
      url: repo.url,
      htmlUrl: repo.html_url,
      private: repo.private,
      fork: repo.fork,
      defaultBranch: repo.default_branch || "main",
      language: repo.language || undefined,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      openIssuesCount: repo.open_issues_count,
      githubCreatedAt: repo.created_at ? new Date(repo.created_at).getTime() : undefined,
      githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at).getTime() : undefined,
      githubPushedAt: repo.pushed_at ? new Date(repo.pushed_at).getTime() : undefined,
    }))

    // Build a map of org logins to their record IDs for linking
    const orgLogins = [
      ...new Set(repos.filter((r) => r.ownerType === "Organization").map((r) => r.owner)),
    ]
    const orgMap = new Map<string, string>()

    if (orgLogins.length > 0) {
      const { organizations } = await adminDb.query({
        organizations: {
          $: { where: { login: { $in: orgLogins } } },
        },
      })

      for (const organization of organizations || []) {
        if (!orgMap.has(organization.login)) {
          orgMap.set(organization.login, organization.id)
        }
      }
    }

    const githubIds = repos.map((repo) => repo.githubId)
    const existingByGithubId = new Map<
      number,
      {
        id: string
        githubUpdatedAt?: number
        githubPushedAt?: number
        createdAt: number
        userId: string
      }
    >()
    if (githubIds.length > 0) {
      const { repos: existingRepos } = await adminDb.query({
        repos: {
          $: { where: { githubId: { $in: githubIds } } },
        },
      })

      for (const existingRepo of existingRepos || []) {
        existingByGithubId.set(existingRepo.githubId, existingRepo)
      }
    }

    const repoTxs = repos
      .map((repo) => {
        const existingRepo = existingByGithubId.get(repo.githubId)
        const isUnchanged =
          existingRepo &&
          existingRepo.userId === this.userId &&
          existingRepo.githubUpdatedAt &&
          repo.githubUpdatedAt &&
          existingRepo.githubUpdatedAt >= repo.githubUpdatedAt &&
          existingRepo.githubPushedAt === repo.githubPushedAt

        if (isUnchanged) {
          return null
        }

        const repoId = existingRepo?.id || id()
        const links: { user: string; organization?: string } = { user: this.userId }
        const orgId = orgMap.get(repo.owner)
        if (orgId) {
          links.organization = orgId
        }

        // Remove ownerType from saved data (not in schema)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ownerType, ...repoData } = repo

        return adminDb.tx.repos[repoId]
          .update({
            ...repoData,
            userId: this.userId,
            syncedAt: now,
            createdAt: existingRepo?.createdAt ?? now,
            updatedAt: now,
          })
          .link(links)
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

    for (const txChunk of chunkItems(repoTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    await this.updateSyncState("repos", null, rateLimit)

    return {
      data: repos.map((repo) => ({
        githubId: repo.githubId,
        fullName: repo.fullName,
        githubPushedAt: repo.githubPushedAt,
        githubUpdatedAt: repo.githubUpdatedAt,
      })),
      rateLimit,
      fromCache: false,
    }
  }

  async fetchPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all",
    force = false,
  ): Promise<SyncResult<{ githubId: number; number: number }[]>> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    const resourceId = `${owner}/${repo}`
    const { syncStates } = await adminDb.query({
      syncStates: {
        $: {
          where: {
            resourceType: "pulls",
            userId: this.userId,
            resourceId,
          },
          limit: 1,
        },
      },
    })

    const lastPullSyncAt = syncStates?.[0]?.lastSyncedAt
    if (!force && lastPullSyncAt && Date.now() - lastPullSyncAt < SYNC_FRESHNESS_MS) {
      const rateLimit = this.lastRateLimit ?? (await this.getRateLimit())
      return { data: [], rateLimit, fromCache: true }
    }

    const allPrsData = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.pulls.list, {
        owner,
        repo,
        state,
        per_page: 100,
        sort: "updated",
        direction: "desc",
      }),
    )

    const rateLimit = await this.getRateLimit()

    const now = Date.now()
    const prs = allPrsData.map((pr) => ({
      githubId: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || undefined,
      state: pr.state,
      draft: pr.draft || false,
      merged: pr.merged_at !== null,
      authorLogin: pr.user?.login || undefined,
      authorAvatarUrl: pr.user?.avatar_url || undefined,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      baseSha: pr.base.sha,
      htmlUrl: pr.html_url,
      diffUrl: pr.diff_url,
      labels: JSON.stringify(pr.labels.map((l) => ({ name: l.name, color: l.color }))),
      githubCreatedAt: pr.created_at ? new Date(pr.created_at).getTime() : undefined,
      githubUpdatedAt: pr.updated_at ? new Date(pr.updated_at).getTime() : undefined,
      closedAt: pr.closed_at ? new Date(pr.closed_at).getTime() : undefined,
      mergedAt: pr.merged_at ? new Date(pr.merged_at).getTime() : undefined,
    }))

    const { pullRequests: existingPullRequests } = await adminDb.query({
      pullRequests: {
        $: { where: { repoId: repoRecord.id } },
      },
    })
    const existingByGithubId = new Map<
      number,
      { id: string; githubUpdatedAt?: number; createdAt: number }
    >()
    for (const existingPullRequest of existingPullRequests || []) {
      existingByGithubId.set(existingPullRequest.githubId, existingPullRequest)
    }

    const prTxs = prs
      .map((pr) => {
        const existingRecord = existingByGithubId.get(pr.githubId)
        if (
          existingRecord?.githubUpdatedAt &&
          pr.githubUpdatedAt &&
          existingRecord.githubUpdatedAt >= pr.githubUpdatedAt
        ) {
          return null
        }

        const prId = existingRecord?.id || id()
        return adminDb.tx.pullRequests[prId]
          .update({
            ...pr,
            repoId: repoRecord.id,
            userId: this.userId,
            syncedAt: now,
            createdAt: existingRecord?.createdAt ?? now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ repo: repoRecord.id })
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

    for (const txChunk of chunkItems(prTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    await this.updateSyncState("pulls", resourceId, rateLimit)

    return { data: prs, rateLimit, fromCache: false }
  }

  async fetchPullRequestDetails(
    owner: string,
    repo: string,
    pullNumber: number,
    force = false,
  ): Promise<{
    prId: string
    rateLimit: RateLimitInfo
    skipped?: boolean
  }> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    if (!force) {
      const { pullRequests: cached } = await adminDb.query({
        pullRequests: {
          $: { where: { number: pullNumber, repoId: repoRecord.id } },
        },
      })
      const cachedPr = cached?.[0]
      if (cachedPr?.syncedAt && Date.now() - cachedPr.syncedAt < SYNC_FRESHNESS_MS) {
        const rateLimit = this.lastRateLimit ?? (await this.getRateLimit())
        return { prId: cachedPr.id, rateLimit, skipped: true }
      }
    }

    const prResponse = await withRateLimitRetry(() =>
      this.octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
    )

    this.extractRateLimit(prResponse.headers as Record<string, string | undefined>)
    const prData = prResponse.data

    const now = Date.now()
    const prGithubId = prData.id

    // First, find or create the PR record and get its ID
    const { pullRequests } = await adminDb.query({
      pullRequests: {
        $: { where: { githubId: prGithubId } },
      },
    })

    const prId = pullRequests?.[0]?.id || id()

    // Upsert PR using the known ID
    await adminDb.transact(
      adminDb.tx.pullRequests[prId]
        .update({
          githubId: prData.id,
          number: prData.number,
          title: prData.title,
          body: prData.body || undefined,
          state: prData.state,
          draft: prData.draft || false,
          merged: prData.merged,
          mergeable: prData.mergeable ?? undefined,
          mergeableState: prData.mergeable_state || undefined,
          authorLogin: prData.user?.login || undefined,
          authorAvatarUrl: prData.user?.avatar_url || undefined,
          headRef: prData.head.ref,
          headSha: prData.head.sha,
          baseRef: prData.base.ref,
          baseSha: prData.base.sha,
          htmlUrl: prData.html_url,
          diffUrl: prData.diff_url,
          additions: prData.additions,
          deletions: prData.deletions,
          changedFiles: prData.changed_files,
          commits: prData.commits,
          comments: prData.comments,
          reviewComments: prData.review_comments,
          labels: JSON.stringify(prData.labels.map((l) => ({ name: l.name, color: l.color }))),
          githubCreatedAt: prData.created_at ? new Date(prData.created_at).getTime() : undefined,
          githubUpdatedAt: prData.updated_at ? new Date(prData.updated_at).getTime() : undefined,
          closedAt: prData.closed_at ? new Date(prData.closed_at).getTime() : undefined,
          mergedAt: prData.merged_at ? new Date(prData.merged_at).getTime() : undefined,
          userId: this.userId, // Required attribute
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId })
        .link({ repo: repoRecord.id }),
    )

    const allFiles = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
    )

    for (const file of allFiles) {
      const { prFiles: existingFiles } = await adminDb.query({
        prFiles: {
          $: { where: { sha: file.sha ?? "", filename: file.filename, pullRequestId: prId } },
        },
      })

      const fileId = existingFiles?.[0]?.id || id()
      await adminDb.transact(
        adminDb.tx.prFiles[fileId]
          .update({
            sha: file.sha ?? "",
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch || undefined,
            previousFilename: file.previous_filename || undefined,
            blobUrl: file.blob_url,
            rawUrl: file.raw_url,
            contentsUrl: file.contents_url,
            pullRequestId: prId,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    const allReviews = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
    )

    const reviewIdMap = new Map<number, string>()
    for (const review of allReviews) {
      // Find or create review and get its ID
      const { prReviews } = await adminDb.query({
        prReviews: {
          $: { where: { githubId: review.id } },
        },
      })

      const reviewId = prReviews?.[0]?.id || id()
      reviewIdMap.set(review.id, reviewId)

      await adminDb.transact(
        adminDb.tx.prReviews[reviewId]
          .update({
            githubId: review.id,
            state: review.state,
            body: review.body || undefined,
            authorLogin: review.user?.login || undefined,
            authorAvatarUrl: review.user?.avatar_url || undefined,
            htmlUrl: review.html_url,
            submittedAt: review.submitted_at ? new Date(review.submitted_at).getTime() : undefined,
            pullRequestId: prId, // Required attribute
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    const allIssueComments = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: pullNumber,
        per_page: 100,
      }),
    )

    for (const comment of allIssueComments) {
      const { prComments: existingComments } = await adminDb.query({
        prComments: {
          $: { where: { githubId: comment.id } },
        },
      })

      const commentId = existingComments?.[0]?.id || id()
      await adminDb.transact(
        adminDb.tx.prComments[commentId]
          .update({
            githubId: comment.id,
            commentType: "issue_comment",
            body: comment.body || undefined,
            authorLogin: comment.user?.login || undefined,
            authorAvatarUrl: comment.user?.avatar_url || undefined,
            htmlUrl: comment.html_url,
            githubCreatedAt: comment.created_at
              ? new Date(comment.created_at).getTime()
              : undefined,
            githubUpdatedAt: comment.updated_at
              ? new Date(comment.updated_at).getTime()
              : undefined,
            pullRequestId: prId,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    const allReviewComments = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.pulls.listReviewComments, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
    )

    for (const comment of allReviewComments) {
      const reviewId = comment.pull_request_review_id
        ? reviewIdMap.get(comment.pull_request_review_id)
        : undefined

      const { prComments: existingReviewComments } = await adminDb.query({
        prComments: {
          $: { where: { githubId: comment.id } },
        },
      })

      const commentId = existingReviewComments?.[0]?.id || id()
      const tx = adminDb.tx.prComments[commentId]
        .update({
          githubId: comment.id,
          commentType: "review_comment",
          body: comment.body || undefined,
          authorLogin: comment.user?.login || undefined,
          authorAvatarUrl: comment.user?.avatar_url || undefined,
          htmlUrl: comment.html_url,
          path: comment.path,
          line: comment.line ?? comment.original_line ?? undefined,
          side: comment.side || undefined,
          diffHunk: comment.diff_hunk || undefined,
          githubCreatedAt: comment.created_at ? new Date(comment.created_at).getTime() : undefined,
          githubUpdatedAt: comment.updated_at ? new Date(comment.updated_at).getTime() : undefined,
          pullRequestId: prId,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId })
        .link({ pullRequest: prId })

      if (reviewId) {
        await adminDb.transact(tx.link({ review: reviewId }))
      } else {
        await adminDb.transact(tx)
      }
    }

    const allCommits = await withRateLimitRetry(() =>
      this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
    )

    for (const commit of allCommits) {
      const commitId = deterministicId("prCommit", prId, commit.sha)
      await adminDb.transact(
        adminDb.tx.prCommits[commitId]
          .update({
            sha: commit.sha,
            message: commit.commit.message,
            authorLogin: commit.author?.login || undefined,
            authorAvatarUrl: commit.author?.avatar_url || undefined,
            authorName: commit.commit.author?.name || undefined,
            authorEmail: commit.commit.author?.email || undefined,
            committerLogin: commit.committer?.login || undefined,
            committerAvatarUrl: commit.committer?.avatar_url || undefined,
            committerName: commit.commit.committer?.name || undefined,
            committerEmail: commit.commit.committer?.email || undefined,
            htmlUrl: commit.html_url,
            committedAt: commit.commit.committer?.date
              ? new Date(commit.commit.committer.date).getTime()
              : undefined,
            pullRequestId: prId, // Required attribute
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Get final rate limit status
    const rateLimit = await this.getRateLimit()
    await this.updateSyncState("pr-detail", `${owner}/${repo}/${pullNumber}`, rateLimit)

    return { prId, rateLimit }
  }

  // Get last rate limit info
  getLastRateLimit(): RateLimitInfo | null {
    return this.lastRateLimit
  }

  // Update pull request state (open/closed)
  async updatePullRequestState(
    owner: string,
    repo: string,
    pullNumber: number,
    state: "open" | "closed",
  ): Promise<{
    number: number
    state: "open" | "closed"
    merged: boolean
  }> {
    const response = await withRateLimitRetry(() =>
      this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        state,
      }),
    )

    this.extractRateLimit(response.headers as Record<string, string | undefined>)

    return {
      number: response.data.number,
      state: response.data.state,
      merged: response.data.merged_at !== null,
    }
  }

  // Merge a pull request
  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    options: {
      commitTitle?: string
      commitMessage?: string
      sha?: string
      mergeMethod?: "merge" | "squash" | "rebase"
    } = {},
  ): Promise<{
    merged: boolean
    message: string
    sha?: string
  }> {
    const response = await withRateLimitRetry(() =>
      this.octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        commit_title: options.commitTitle,
        commit_message: options.commitMessage,
        sha: options.sha,
        merge_method: options.mergeMethod,
      }),
    )

    this.extractRateLimit(response.headers as Record<string, string | undefined>)

    return {
      merged: response.data.merged,
      message: response.data.message,
      sha: response.data.sha,
    }
  }

  // Fetch repository tree (file structure)
  async fetchRepoTree(
    owner: string,
    repo: string,
    ref?: string,
  ): Promise<{
    count: number
    rateLimit: RateLimitInfo
  }> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)
    const branch = ref || repoRecord.defaultBranch || "main"

    const response = await withRateLimitRetry(() =>
      this.octokit.rest.git.getTree({ owner, repo, tree_sha: branch, recursive: "1" }),
    )

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)
    const now = Date.now()

    const entries = buildTreeEntries(
      response.data.tree as GitHubTreeItem[],
      repoRecord.id,
      branch,
      owner,
      repo,
      now,
    )

    const { repoTrees: allExisting } = await adminDb.query({
      repoTrees: {
        $: { where: { ref: branch, repoId: repoRecord.id } },
      },
    })

    const existingById = new Map<
      string,
      { createdAt?: number; sha?: string; type?: string; size?: number }
    >()
    for (const existingEntry of allExisting || []) {
      existingById.set(existingEntry.id, {
        createdAt: existingEntry.createdAt,
        sha: existingEntry.sha,
        type: existingEntry.type,
        size: existingEntry.size,
      })
    }

    const entryTxs = entries
      .map((entry) => {
        const existingEntry = existingById.get(entry.id)
        const isUnchanged =
          existingEntry &&
          existingEntry.sha === entry.sha &&
          existingEntry.type === entry.type &&
          existingEntry.size === entry.size

        if (isUnchanged) {
          return null
        }

        return adminDb.tx.repoTrees[entry.id]
          .update({
            ref: entry.ref,
            path: entry.path,
            name: entry.name,
            type: entry.type,
            sha: entry.sha,
            size: entry.size,
            url: entry.url,
            htmlUrl: entry.htmlUrl,
            repoId: entry.repoId,
            createdAt: existingEntry?.createdAt ?? entry.createdAt,
            updatedAt: entry.updatedAt,
          })
          .link({ user: this.userId })
          .link({ repo: repoRecord.id })
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

    for (const txChunk of chunkItems(entryTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    // Remove stale entries that no longer exist in the tree
    const incomingPaths = new Set(entries.map((e) => e.path))
    const staleIds = computeStaleEntries(allExisting || [], incomingPaths)
    const deleteTxs = staleIds.map((staleId) => adminDb.tx.repoTrees[staleId].delete())
    for (const txChunk of chunkItems(deleteTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    await this.updateSyncState("tree", `${owner}/${repo}:${branch}`, rateLimit)

    return { count: response.data.tree.length, rateLimit }
  }

  // Fetch repository commit history for a branch
  async fetchRepoCommits(
    owner: string,
    repo: string,
    ref?: string,
  ): Promise<{
    count: number
    rateLimit: RateLimitInfo
  }> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)
    const branch = ref || repoRecord.defaultBranch || "main"

    const allCommits = await withRateLimitRetry(() =>
      this.octokit.paginate(
        this.octokit.rest.repos.listCommits,
        { owner, repo, sha: branch, per_page: 100 },
        (response) => {
          const rateLimit = this.extractRateLimit(
            response.headers as Record<string, string | undefined>,
          )
          this.lastRateLimit = rateLimit
          return response.data
        },
      ),
    )

    const rateLimit = this.lastRateLimit || {
      remaining: 0,
      limit: 5000,
      reset: new Date(),
      used: 0,
    }
    const now = Date.now()

    const commitEntries = buildCommitEntries(
      allCommits as GitHubCommit[],
      repoRecord.id,
      branch,
      now,
    )

    const { repoCommits: allExisting } = await adminDb.query({
      repoCommits: {
        $: { where: { ref: branch, repoId: repoRecord.id } },
      },
    })

    const existingById = new Map<
      string,
      { createdAt?: number; message?: string; committedAt?: number }
    >()
    for (const existingCommit of allExisting || []) {
      existingById.set(existingCommit.id, {
        createdAt: existingCommit.createdAt,
        message: typeof existingCommit.message === "string" ? existingCommit.message : undefined,
        committedAt: existingCommit.committedAt,
      })
    }

    const commitTxs = commitEntries
      .map((entry) => {
        const existingCommit = existingById.get(entry.id)
        const isUnchanged =
          existingCommit &&
          existingCommit.message === entry.message &&
          existingCommit.committedAt === entry.committedAt

        if (isUnchanged) {
          return null
        }

        return adminDb.tx.repoCommits[entry.id]
          .update({
            sha: entry.sha,
            message: entry.message,
            authorLogin: entry.authorLogin,
            authorAvatarUrl: entry.authorAvatarUrl,
            authorName: entry.authorName,
            authorEmail: entry.authorEmail,
            committerLogin: entry.committerLogin,
            committerName: entry.committerName,
            committerEmail: entry.committerEmail,
            htmlUrl: entry.htmlUrl,
            ref: entry.ref,
            repoId: entry.repoId,
            committedAt: entry.committedAt,
            createdAt: existingCommit?.createdAt ?? entry.createdAt,
            updatedAt: entry.updatedAt,
          })
          .link({ user: this.userId })
          .link({ repo: repoRecord.id })
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

    for (const txChunk of chunkItems(commitTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    // Remove stale commits no longer in the branch history
    const incomingShas = new Set(commitEntries.map((e) => e.sha))
    const staleIds = computeStaleCommits(allExisting || [], incomingShas)
    const deleteTxs = staleIds.map((staleId) => adminDb.tx.repoCommits[staleId].delete())
    for (const txChunk of chunkItems(deleteTxs, TRANSACT_CHUNK_SIZE)) {
      await adminDb.transact(txChunk)
    }

    await this.updateSyncState("commits", `${owner}/${repo}:${branch}`, rateLimit)

    return { count: allCommits.length, rateLimit }
  }

  // Register webhooks for a repository
  // Webhook status type for tracking
  static readonly WEBHOOK_STATUS = {
    INSTALLED: "installed",
    ERROR: "error",
    NOT_INSTALLED: "not_installed",
    NO_ACCESS: "no_access",
  } as const

  async registerRepoWebhook(
    owner: string,
    repo: string,
  ): Promise<{ success: boolean; status: string; error?: string }> {
    const webhookConfig = getWebhookRegistrationConfig()
    const fullName = `${owner}/${repo}`

    // Helper to update webhook status in database
    const updateWebhookStatus = async (status: string, error?: string) => {
      const { repos } = await adminDb.query({
        repos: { $: { where: { fullName } } },
      })
      if (repos?.[0]) {
        await adminDb.transact(
          adminDb.tx.repos[repos[0].id].update({
            webhookStatus: status,
            webhookError: error,
            updatedAt: Date.now(),
          }),
        )
      }
    }

    if (!webhookConfig.enabled || !webhookConfig.webhookUrl) {
      const error = webhookConfig.reason ?? "Webhook registration disabled"
      log.info("Skipping webhook registration", { repo: fullName, reason: error })
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.NOT_INSTALLED, error)
      return { success: false, status: GitHubClient.WEBHOOK_STATUS.NOT_INSTALLED, error }
    }

    const webhookUrl = webhookConfig.webhookUrl
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET as string

    try {
      // Check if webhook already exists (with pagination)
      const existingHooks = await this.octokit.paginate(this.octokit.rest.repos.listWebhooks, {
        owner,
        repo,
        per_page: 100,
      })

      const existingHook = existingHooks.find((hook) => hook.config.url === webhookUrl)

      if (existingHook) {
        log.info("Webhook already exists", { repo: fullName })
        await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.INSTALLED)
        return { success: true, status: GitHubClient.WEBHOOK_STATUS.INSTALLED }
      }

      // Create webhook
      await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: webhookSecret,
          insecure_ssl: "0",
        },
        events: [
          "push",
          "pull_request",
          "pull_request_review",
          "pull_request_review_comment",
          "issue_comment",
          "issues",
          "create",
          "delete",
          "fork",
          "star",
          "repository",
        ],
        active: true,
      })

      log.info("Webhook registered", { repo: fullName })
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.INSTALLED)
      return { success: true, status: GitHubClient.WEBHOOK_STATUS.INSTALLED }
    } catch (err) {
      const error = err as {
        status?: number
        message?: string
        response?: { data?: { message?: string; errors?: Array<{ message?: string }> } }
      }
      const errorMessage = error.response?.data?.message || error.message || "unknown error"

      // 422 with "Hook already exists" means webhook is already installed (possibly with different config)
      if (error.status === 422 && errorMessage.includes("Hook already exists")) {
        log.info("Webhook already exists (different config)", { repo: fullName })
        await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.INSTALLED)
        return { success: true, status: GitHubClient.WEBHOOK_STATUS.INSTALLED }
      }

      // 404 or 403 means we don't have permission - that's expected for repos we don't own
      if (error.status === 404 || error.status === 403) {
        log.info("No webhook access (expected for non-owned repos)", {
          repo: fullName,
          status: error.status,
          reason: errorMessage,
        })
        await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.NO_ACCESS, errorMessage)
        return {
          success: false,
          status: GitHubClient.WEBHOOK_STATUS.NO_ACCESS,
          error: errorMessage,
        }
      }

      log.error("Webhook registration failed", err, { repo: fullName, reason: errorMessage })
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.ERROR, errorMessage)
      return { success: false, status: GitHubClient.WEBHOOK_STATUS.ERROR, error: errorMessage }
    }
  }

  // Register webhooks for all repos belonging to this user
  async registerAllWebhooks(
    repoList?: Array<{ fullName: string; webhookStatus?: string }>,
  ): Promise<{
    total: number
    installed: number
    skipped: number
    noAccess: number
    errors: number
    results: Array<{ fullName: string; status: string; error?: string; skipped?: boolean }>
  }> {
    const repos =
      repoList ||
      (
        await adminDb.query({
          repos: { $: { where: { userId: this.userId } } },
        })
      ).repos ||
      []

    const webhookConfig = getWebhookRegistrationConfig()
    if (!webhookConfig.enabled) {
      const reason = webhookConfig.reason ?? "Webhook registration disabled"
      log.info("Skipping webhook registration for all repositories", {
        userId: this.userId,
        reason,
        repoCount: repos.length,
      })

      return {
        total: repos.length,
        installed: 0,
        skipped: repos.length,
        noAccess: 0,
        errors: 0,
        results: repos.map((repo) => ({
          fullName: repo.fullName,
          status: GitHubClient.WEBHOOK_STATUS.NOT_INSTALLED,
          error: reason,
          skipped: true,
        })),
      }
    }

    const results = await mapWithConcurrency(
      repos,
      WEBHOOK_REGISTRATION_CONCURRENCY,
      async (repo) => {
        if (repo.webhookStatus === GitHubClient.WEBHOOK_STATUS.INSTALLED) {
          return {
            fullName: repo.fullName,
            status: GitHubClient.WEBHOOK_STATUS.INSTALLED,
            skipped: true,
          }
        }

        const [owner, repoName] = repo.fullName.split("/")
        if (!owner || !repoName) {
          return {
            fullName: repo.fullName,
            status: GitHubClient.WEBHOOK_STATUS.ERROR,
            error: "Invalid repository full name",
          }
        }

        const result = await this.registerRepoWebhook(owner, repoName)
        return { fullName: repo.fullName, status: result.status, error: result.error }
      },
    )

    let installed = 0
    let skipped = 0
    let noAccess = 0
    let errors = 0
    for (const result of results) {
      if (result.skipped) {
        skipped++
        continue
      }
      if (result.status === GitHubClient.WEBHOOK_STATUS.INSTALLED) {
        installed++
      } else if (result.status === GitHubClient.WEBHOOK_STATUS.NO_ACCESS) {
        noAccess++
      } else {
        errors++
      }
    }

    return {
      total: repos.length,
      installed,
      skipped,
      noAccess,
      errors,
      results,
    }
  }

  // Update initial sync progress in database
  private async updateInitialSyncProgress(progress: {
    step: "orgs" | "repos" | "webhooks" | "pullRequests" | "completed"
    orgs?: { total: number }
    repos?: { total: number }
    webhooks?: { completed: number; total: number }
    pullRequests?: { completed: number; total: number; prsFound: number }
    error?: string
  }) {
    const stateId = await findOrCreateSyncStateId("initial_sync", this.userId)
    const now = Date.now()

    await adminDb.transact(
      adminDb.tx.syncStates[stateId]
        .update({
          resourceType: "initial_sync",
          syncStatus: progress.step === "completed" ? "completed" : "syncing",
          lastEtag: JSON.stringify(progress), // Store progress as JSON
          syncError: progress.error,
          userId: this.userId,
          lastSyncedAt: progress.step === "completed" ? now : undefined,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId }),
    )
  }

  async performInitialSync(): Promise<{
    orgs: number
    repos: number
    webhooks: number
    openPRs: number
  }> {
    log.info("Starting initial sync", { userId: this.userId })

    let orgsCount = 0
    let reposCount = 0
    let webhooksRegistered = 0
    let totalOpenPRs = 0
    let reposData: RepositorySyncItem[] = []

    const updateProgress = (
      step: "orgs" | "repos" | "webhooks" | "pullRequests" | "completed",
      extra?: { error?: string; prCompleted?: number; prTotal?: number },
    ) =>
      this.updateInitialSyncProgress({
        step,
        orgs: { total: orgsCount },
        repos: { total: reposCount },
        webhooks: { completed: webhooksRegistered, total: reposCount },
        pullRequests: {
          completed: extra?.prCompleted ?? 0,
          total: extra?.prTotal ?? reposCount,
          prsFound: totalOpenPRs,
        },
        error: extra?.error,
      })

    // Step 1: Organizations
    try {
      await updateProgress("orgs")
      const orgsResult = await this.fetchOrganizations()
      orgsCount = orgsResult.data.length
      log.info("Synced organizations", { count: orgsCount, userId: this.userId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sync organizations"
      await updateProgress("orgs", { error: msg })
      throw err
    }

    // Step 2: Repositories
    try {
      await updateProgress("repos")
      const reposResult = await this.fetchRepositories()
      reposCount = reposResult.data.length
      reposData = reposResult.data
      log.info("Synced repositories", { count: reposCount, userId: this.userId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sync repositories"
      await updateProgress("repos", { error: msg })
      throw err
    }

    // Step 3: Webhooks
    try {
      await updateProgress("webhooks")
      const webhookResult = await this.registerAllWebhooks(reposData)
      webhooksRegistered = webhookResult.installed + webhookResult.skipped
      log.info("Registered webhooks", {
        count: webhooksRegistered,
        noAccess: webhookResult.noAccess,
        errors: webhookResult.errors,
        userId: this.userId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to register webhooks"
      await updateProgress("webhooks", { error: msg })
      throw err
    }

    // Step 4: Sync open PRs for active repos that need pull refresh
    const sortedRepos = [...reposData].sort((a, b) => {
      const aTime = Math.max(a.githubPushedAt ?? 0, a.githubUpdatedAt ?? 0)
      const bTime = Math.max(b.githubPushedAt ?? 0, b.githubUpdatedAt ?? 0)
      return bTime - aTime
    })

    const { syncStates: pullSyncStates } = await adminDb.query({
      syncStates: {
        $: {
          where: {
            resourceType: "pulls",
            userId: this.userId,
          },
        },
      },
    })
    const reposToSync = selectReposForPullSync(sortedRepos, pullSyncStates || [])

    await updateProgress("pullRequests", { prCompleted: 0, prTotal: reposToSync.length })

    let prErrors = 0
    let prCompleted = 0
    let progressWrite = Promise.resolve()
    const queuePullProgressUpdate = (completed: number) => {
      progressWrite = progressWrite.then(() =>
        updateProgress("pullRequests", {
          prCompleted: completed,
          prTotal: reposToSync.length,
        }),
      )
      return progressWrite
    }

    await mapWithConcurrency(reposToSync, INITIAL_SYNC_PR_CONCURRENCY, async (repo, index) => {
      try {
        const [owner, repoName] = repo.fullName.split("/")
        if (!owner || !repoName) {
          prErrors++
          log.error("Skipping invalid repo name during initial sync", undefined, {
            repo: repo.fullName,
            index,
            userId: this.userId,
          })
          return
        }

        const prsResult = await this.fetchPullRequests(owner, repoName, "open")
        totalOpenPRs += prsResult.data.length
      } catch (err) {
        prErrors++
        log.error("PR sync failed during initial sync", err, {
          repo: repo.fullName,
          index,
          userId: this.userId,
        })
        if (isRateLimitError(err)) {
          log.warn("Rate limited during PR sync, pausing worker", {
            repo: repo.fullName,
            index,
            total: reposToSync.length,
          })
          const delay = err instanceof RequestError ? getRateLimitRetryDelay(err) : 60_000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      } finally {
        prCompleted++
        await queuePullProgressUpdate(prCompleted)
      }
    })
    await progressWrite

    log.info("Initial PR sync complete", {
      openPRs: totalOpenPRs,
      repos: reposToSync.length,
      skippedRepos: sortedRepos.length - reposToSync.length,
      errors: prErrors,
      userId: this.userId,
    })

    await updateProgress("completed")

    return {
      orgs: orgsCount,
      repos: reposCount,
      webhooks: webhooksRegistered,
      openPRs: totalOpenPRs,
    }
  }
}

export async function createGitHubClient(userId: string): Promise<GitHubClient | null> {
  try {
    const { syncStates } = await adminDb.query({
      syncStates: {
        $: {
          where: {
            resourceType: "github:token",
            userId,
          },
        },
      },
    })

    const tokenState = syncStates?.[0]

    if (tokenState?.syncStatus === "auth_invalid") {
      log.warn("GitHub token is known-invalid", { userId })
      return null
    }

    const accessToken = tokenState?.lastEtag

    if (accessToken) {
      return new GitHubClient(accessToken, userId)
    }

    const globalToken = process.env.GITHUB_ACCESS_TOKEN
    if (globalToken) {
      log.info("Using global GitHub access token (user token not found)", { userId })
      return new GitHubClient(globalToken, userId)
    }

    log.warn("No GitHub access token available", { userId })
    return null
  } catch (err) {
    log.error("Failed to fetch GitHub token", err, { userId })

    // Fall back to environment variable
    const globalToken = process.env.GITHUB_ACCESS_TOKEN
    if (globalToken) {
      return new GitHubClient(globalToken, userId)
    }

    return null
  }
}
