import { Octokit } from "octokit"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { eq, and } from "drizzle-orm"
import * as schema from "../../schema"

// Types for rate limit info
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

// GitHub API client with rate limit tracking
export class GitHubClient {
  private octokit: Octokit
  private db: ReturnType<typeof drizzle>
  private userId: string
  private lastRateLimit: RateLimitInfo | null = null

  constructor(accessToken: string, userId: string, pool: Pool) {
    this.octokit = new Octokit({ auth: accessToken })
    this.db = drizzle(pool, { schema })
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

  // Update sync state in database
  async updateSyncState(
    resourceType: string,
    resourceId: string | null,
    rateLimit: RateLimitInfo,
    status: "idle" | "syncing" | "error" = "idle",
    error?: string,
    etag?: string,
  ) {
    const id = `${this.userId}:${resourceType}${resourceId ? `:${resourceId}` : ""}`

    await this.db
      .insert(schema.githubSyncState)
      .values({
        id,
        userId: this.userId,
        resourceType,
        resourceId,
        lastSyncedAt: new Date(),
        lastEtag: etag,
        rateLimitRemaining: rateLimit.remaining,
        rateLimitReset: rateLimit.reset,
        syncStatus: status,
        syncError: error,
      })
      .onConflictDoUpdate({
        target: schema.githubSyncState.id,
        set: {
          lastSyncedAt: new Date(),
          lastEtag: etag,
          rateLimitRemaining: rateLimit.remaining,
          rateLimitReset: rateLimit.reset,
          syncStatus: status,
          syncError: error,
          updatedAt: new Date(),
        },
      })
  }

  // Get sync state from database
  async getSyncState(resourceType: string, resourceId: string | null) {
    const id = `${this.userId}:${resourceType}${resourceId ? `:${resourceId}` : ""}`

    const result = await this.db
      .select()
      .from(schema.githubSyncState)
      .where(eq(schema.githubSyncState.id, id))
      .limit(1)

    return result[0] || null
  }

  private parseRepoFullNameFromApiUrl(repositoryUrl: string | null | undefined): string | null {
    if (!repositoryUrl) return null
    try {
      const url = new URL(repositoryUrl)
      const parts = url.pathname.split("/").filter(Boolean)
      const reposIdx = parts.indexOf("repos")
      if (reposIdx >= 0 && parts.length >= reposIdx + 3) {
        return `${parts[reposIdx + 1]}/${parts[reposIdx + 2]}`
      }
      return null
    } catch {
      return null
    }
  }

  private async ensureRepoRecord(owner: string, repo: string) {
    const fullName = `${owner}/${repo}`
    const existing = await this.db
      .select()
      .from(schema.githubRepo)
      .where(
        and(eq(schema.githubRepo.fullName, fullName), eq(schema.githubRepo.userId, this.userId)),
      )
      .limit(1)

    if (existing[0]) {
      return existing[0]
    }

    const response = await this.octokit.rest.repos.get({ owner, repo })
    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const repoData = response.data
    const repoInsert = {
      id: repoData.node_id,
      githubId: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      owner: repoData.owner.login,
      description: repoData.description || null,
      url: repoData.url,
      htmlUrl: repoData.html_url,
      private: repoData.private,
      fork: repoData.fork,
      defaultBranch: repoData.default_branch || "main",
      language: repoData.language || null,
      stargazersCount: repoData.stargazers_count,
      forksCount: repoData.forks_count,
      openIssuesCount: repoData.open_issues_count,
      organizationId: null,
      userId: this.userId,
      githubCreatedAt: repoData.created_at ? new Date(repoData.created_at) : null,
      githubUpdatedAt: repoData.updated_at ? new Date(repoData.updated_at) : null,
      githubPushedAt: repoData.pushed_at ? new Date(repoData.pushed_at) : null,
      syncedAt: new Date(),
    }

    await this.db
      .insert(schema.githubRepo)
      .values(repoInsert)
      .onConflictDoUpdate({
        target: schema.githubRepo.id,
        set: {
          name: repoInsert.name,
          fullName: repoInsert.fullName,
          owner: repoInsert.owner,
          description: repoInsert.description,
          url: repoInsert.url,
          htmlUrl: repoInsert.htmlUrl,
          private: repoInsert.private,
          fork: repoInsert.fork,
          defaultBranch: repoInsert.defaultBranch,
          language: repoInsert.language,
          stargazersCount: repoInsert.stargazersCount,
          forksCount: repoInsert.forksCount,
          openIssuesCount: repoInsert.openIssuesCount,
          githubCreatedAt: repoInsert.githubCreatedAt,
          githubUpdatedAt: repoInsert.githubUpdatedAt,
          githubPushedAt: repoInsert.githubPushedAt,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      })

    await this.updateSyncState("repo", fullName, rateLimit)

    const inserted = await this.db
      .select()
      .from(schema.githubRepo)
      .where(
        and(eq(schema.githubRepo.fullName, fullName), eq(schema.githubRepo.userId, this.userId)),
      )
      .limit(1)

    return inserted[0] ?? repoInsert
  }

  // Fetch dashboard PRs: authored by user and review requested
  async fetchPullRequestDashboard(limit = 50): Promise<{
    authored: PullRequestDashboardItem[]
    reviewRequested: PullRequestDashboardItem[]
    rateLimit: RateLimitInfo
  }> {
    const userResponse = await this.octokit.rest.users.getAuthenticated()
    let rateLimit = this.extractRateLimit(
      userResponse.headers as Record<string, string | undefined>,
    )

    const login = userResponse.data.login

    const runSearch = async (q: string): Promise<PullRequestDashboardItem[]> => {
      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q,
        per_page: Math.min(100, Math.max(1, limit)),
        sort: "updated",
        order: "desc",
      })

      rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

      const items: PullRequestDashboardItem[] = []
      for (const item of response.data.items) {
        const repoFullName = this.parseRepoFullNameFromApiUrl(
          // This is an API URL like https://api.github.com/repos/owner/repo
          (item as unknown as { repository_url?: string }).repository_url ?? null,
        )
        if (!repoFullName) continue

        items.push({
          id: item.node_id,
          repoFullName,
          number: item.number,
          title: item.title,
          state: item.state as "open" | "closed",
          draft: false,
          merged: false,
          authorLogin: item.user?.login ?? null,
          authorAvatarUrl: item.user?.avatar_url ?? null,
          comments: item.comments ?? 0,
          reviewComments: 0,
          htmlUrl: item.html_url ?? null,
          githubCreatedAt: item.created_at ? new Date(item.created_at) : null,
          githubUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
        })
      }
      return items
    }

    const authored = await runSearch(`is:pr is:open author:${login} archived:false`)
    const reviewRequested = await runSearch(
      `is:pr is:open review-requested:${login} archived:false`,
    )

    await this.updateSyncState("pr-dashboard", null, rateLimit)

    return { authored, reviewRequested, rateLimit }
  }

  // Sync dashboard PRs to database: authored by user and review requested
  async syncPullRequestDashboard(limit = 50): Promise<{
    authoredCount: number
    reviewRequestedCount: number
    rateLimit: RateLimitInfo
  }> {
    const userResponse = await this.octokit.rest.users.getAuthenticated()
    let rateLimit = this.extractRateLimit(
      userResponse.headers as Record<string, string | undefined>,
    )

    const login = userResponse.data.login

    // Helper to search and sync PRs
    const searchAndSync = async (q: string, isReviewRequested: boolean): Promise<number> => {
      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q,
        per_page: Math.min(100, Math.max(1, limit)),
        sort: "updated",
        order: "desc",
      })

      rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

      let syncedCount = 0
      for (const item of response.data.items) {
        const repoFullName = this.parseRepoFullNameFromApiUrl(
          (item as unknown as { repository_url?: string }).repository_url ?? null,
        )
        if (!repoFullName) continue

        const [owner, repo] = repoFullName.split("/")
        if (!owner || !repo) continue

        // Ensure repo exists in database
        const repoRecord = await this.ensureRepoRecord(owner, repo)
        if (!repoRecord) continue

        // Build reviewRequestedBy: if this is a review-requested search, add current user
        let reviewRequestedBy: string | null = null
        if (isReviewRequested) {
          // Check existing PR to merge with existing reviewRequestedBy
          const existingPr = await this.db
            .select()
            .from(schema.githubPullRequest)
            .where(eq(schema.githubPullRequest.id, item.node_id))
            .limit(1)

          const existingReviewers = existingPr[0]?.reviewRequestedBy
            ? (JSON.parse(existingPr[0].reviewRequestedBy) as string[])
            : []

          if (!existingReviewers.includes(login)) {
            existingReviewers.push(login)
          }
          reviewRequestedBy = JSON.stringify(existingReviewers)
        }

        // Upsert PR to database
        const prData = {
          id: item.node_id,
          githubId: (item as unknown as { id: number }).id,
          number: item.number,
          repoId: repoRecord.id,
          title: item.title,
          body: item.body ?? null,
          state: item.state,
          draft: false,
          merged: false,
          authorLogin: item.user?.login ?? null,
          authorAvatarUrl: item.user?.avatar_url ?? null,
          htmlUrl: item.html_url ?? null,
          comments: item.comments ?? 0,
          reviewComments: 0,
          labels: JSON.stringify(
            (item.labels ?? []).map((l) =>
              typeof l === "string" ? { name: l } : { name: l.name, color: l.color },
            ),
          ),
          reviewRequestedBy,
          githubCreatedAt: item.created_at ? new Date(item.created_at) : null,
          githubUpdatedAt: item.updated_at ? new Date(item.updated_at) : null,
          closedAt: item.closed_at ? new Date(item.closed_at) : null,
          userId: this.userId,
          syncedAt: new Date(),
        }

        await this.db
          .insert(schema.githubPullRequest)
          .values(prData)
          .onConflictDoUpdate({
            target: schema.githubPullRequest.id,
            set: {
              title: prData.title,
              body: prData.body,
              state: prData.state,
              draft: prData.draft,
              merged: prData.merged,
              authorLogin: prData.authorLogin,
              authorAvatarUrl: prData.authorAvatarUrl,
              htmlUrl: prData.htmlUrl,
              comments: prData.comments,
              labels: prData.labels,
              ...(isReviewRequested ? { reviewRequestedBy: prData.reviewRequestedBy } : {}),
              githubUpdatedAt: prData.githubUpdatedAt,
              closedAt: prData.closedAt,
              syncedAt: new Date(),
              updatedAt: new Date(),
            },
          })

        syncedCount++
      }

      return syncedCount
    }

    // Sync authored PRs
    const authoredCount = await searchAndSync(`is:pr is:open author:${login} archived:false`, false)

    // Sync review-requested PRs
    const reviewRequestedCount = await searchAndSync(
      `is:pr is:open review-requested:${login} archived:false`,
      true,
    )

    await this.updateSyncState("pr-dashboard", null, rateLimit)

    return { authoredCount, reviewRequestedCount, rateLimit }
  }

  // Fetch user's organizations
  async fetchOrganizations(): Promise<
    SyncResult<(typeof schema.githubOrganization.$inferInsert)[]>
  > {
    const response = await this.octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100,
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const orgs = response.data.map((org) => ({
      id: org.node_id,
      githubId: org.id,
      login: org.login,
      name: org.login, // GitHub API doesn't return name in list
      description: org.description || null,
      avatarUrl: org.avatar_url,
      url: org.url,
      userId: this.userId,
      syncedAt: new Date(),
    }))

    // Upsert organizations
    for (const org of orgs) {
      await this.db
        .insert(schema.githubOrganization)
        .values(org)
        .onConflictDoUpdate({
          target: schema.githubOrganization.id,
          set: {
            login: org.login,
            name: org.name,
            description: org.description,
            avatarUrl: org.avatarUrl,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
    }

    await this.updateSyncState("orgs", null, rateLimit)

    return { data: orgs, rateLimit, fromCache: false }
  }

  // Fetch user's repositories (personal and org repos)
  async fetchRepositories(): Promise<SyncResult<(typeof schema.githubRepo.$inferInsert)[]>> {
    const response = await this.octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const repos = response.data.map((repo) => ({
      id: repo.node_id,
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description || null,
      url: repo.url,
      htmlUrl: repo.html_url,
      private: repo.private,
      fork: repo.fork,
      defaultBranch: repo.default_branch || "main",
      language: repo.language || null,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      openIssuesCount: repo.open_issues_count,
      organizationId: null, // Will be linked if org exists
      userId: this.userId,
      // GitHub timestamps
      githubCreatedAt: repo.created_at ? new Date(repo.created_at) : null,
      githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : null,
      githubPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
      syncedAt: new Date(),
    }))

    // Upsert repositories
    for (const repo of repos) {
      await this.db
        .insert(schema.githubRepo)
        .values(repo)
        .onConflictDoUpdate({
          target: schema.githubRepo.id,
          set: {
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            private: repo.private,
            fork: repo.fork,
            defaultBranch: repo.defaultBranch,
            language: repo.language,
            stargazersCount: repo.stargazersCount,
            forksCount: repo.forksCount,
            openIssuesCount: repo.openIssuesCount,
            githubCreatedAt: repo.githubCreatedAt,
            githubUpdatedAt: repo.githubUpdatedAt,
            githubPushedAt: repo.githubPushedAt,
            syncedAt: new Date(),
          },
        })
    }

    await this.updateSyncState("repos", null, rateLimit)

    return { data: repos, rateLimit, fromCache: false }
  }

  // Fetch pull requests for a repository
  async fetchPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all",
  ): Promise<SyncResult<(typeof schema.githubPullRequest.$inferInsert)[]>> {
    // Ensure the repo exists in our DB so we can link PRs to repoId
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    const response = await this.octokit.rest.pulls.list({
      owner,
      repo,
      state,
      per_page: 100,
      sort: "updated",
      direction: "desc",
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const prs = response.data.map((pr) => ({
      id: pr.node_id,
      githubId: pr.id,
      number: pr.number,
      repoId: repoRecord.id,
      title: pr.title,
      body: pr.body || null,
      state: pr.state,
      draft: pr.draft || false,
      merged: pr.merged_at !== null,
      // mergeable and mergeable_state are not available on pulls.list() - only on pulls.get()
      mergeable: null,
      mergeableState: null,
      authorLogin: pr.user?.login || null,
      authorAvatarUrl: pr.user?.avatar_url || null,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      baseSha: pr.base.sha,
      htmlUrl: pr.html_url,
      diffUrl: pr.diff_url,
      // These fields are not available on pulls.list() - only on pulls.get()
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      commits: 0,
      comments: 0,
      reviewComments: 0,
      labels: JSON.stringify(pr.labels.map((l) => ({ name: l.name, color: l.color }))),
      githubCreatedAt: pr.created_at ? new Date(pr.created_at) : null,
      githubUpdatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      userId: this.userId,
      syncedAt: new Date(),
    }))

    // Upsert pull requests
    for (const pr of prs) {
      await this.db
        .insert(schema.githubPullRequest)
        .values(pr)
        .onConflictDoUpdate({
          target: schema.githubPullRequest.id,
          set: {
            title: pr.title,
            body: pr.body,
            state: pr.state,
            draft: pr.draft,
            merged: pr.merged,
            mergeable: pr.mergeable,
            mergeableState: pr.mergeableState,
            headSha: pr.headSha,
            additions: pr.additions,
            deletions: pr.deletions,
            changedFiles: pr.changedFiles,
            commits: pr.commits,
            comments: pr.comments,
            reviewComments: pr.reviewComments,
            labels: pr.labels,
            githubUpdatedAt: pr.githubUpdatedAt,
            closedAt: pr.closedAt,
            mergedAt: pr.mergedAt,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
    }

    await this.updateSyncState("pulls", `${owner}/${repo}`, rateLimit)

    return { data: prs, rateLimit, fromCache: false }
  }

  // Fetch detailed PR info including files, comments, and reviews
  async fetchPullRequestDetails(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{
    pr: typeof schema.githubPullRequest.$inferInsert
    files: (typeof schema.githubPrFile.$inferInsert)[]
    reviews: (typeof schema.githubPrReview.$inferInsert)[]
    comments: (typeof schema.githubPrComment.$inferInsert)[]
    rateLimit: RateLimitInfo
  }> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    // Fetch PR details
    const prResponse = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    })

    let rateLimit = this.extractRateLimit(prResponse.headers as Record<string, string | undefined>)
    const prData = prResponse.data

    const pr = {
      id: prData.node_id,
      githubId: prData.id,
      number: prData.number,
      repoId: repoRecord.id,
      title: prData.title,
      body: prData.body || null,
      state: prData.state,
      draft: prData.draft || false,
      merged: prData.merged,
      mergeable: prData.mergeable,
      mergeableState: prData.mergeable_state || null,
      authorLogin: prData.user?.login || null,
      authorAvatarUrl: prData.user?.avatar_url || null,
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
      githubCreatedAt: prData.created_at ? new Date(prData.created_at) : null,
      githubUpdatedAt: prData.updated_at ? new Date(prData.updated_at) : null,
      closedAt: prData.closed_at ? new Date(prData.closed_at) : null,
      mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
      userId: this.userId,
      syncedAt: new Date(),
    }

    // Upsert PR
    await this.db
      .insert(schema.githubPullRequest)
      .values(pr)
      .onConflictDoUpdate({
        target: schema.githubPullRequest.id,
        set: {
          title: pr.title,
          body: pr.body,
          state: pr.state,
          draft: pr.draft,
          merged: pr.merged,
          mergeable: pr.mergeable,
          mergeableState: pr.mergeableState,
          headSha: pr.headSha,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          commits: pr.commits,
          comments: pr.comments,
          reviewComments: pr.reviewComments,
          labels: pr.labels,
          githubUpdatedAt: pr.githubUpdatedAt,
          closedAt: pr.closedAt,
          mergedAt: pr.mergedAt,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      })

    // Fetch files
    const filesResponse = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(filesResponse.headers as Record<string, string | undefined>)

    const files = filesResponse.data.map((file) => ({
      id: `${pr.id}:${file.sha}:${file.filename}`,
      pullRequestId: pr.id,
      sha: file.sha ?? "",
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || null,
      previousFilename: file.previous_filename || null,
      blobUrl: file.blob_url,
      rawUrl: file.raw_url,
      contentsUrl: file.contents_url,
      userId: this.userId,
    }))

    // Delete old files and insert new ones
    await this.db.delete(schema.githubPrFile).where(eq(schema.githubPrFile.pullRequestId, pr.id))

    for (const file of files) {
      await this.db.insert(schema.githubPrFile).values(file)
    }

    // Fetch reviews
    const reviewsResponse = await this.octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(reviewsResponse.headers as Record<string, string | undefined>)

    const reviews = reviewsResponse.data.map((review) => ({
      id: review.node_id,
      githubId: review.id,
      pullRequestId: pr.id,
      state: review.state,
      body: review.body || null,
      authorLogin: review.user?.login || null,
      authorAvatarUrl: review.user?.avatar_url || null,
      htmlUrl: review.html_url,
      submittedAt: review.submitted_at ? new Date(review.submitted_at) : null,
      userId: this.userId,
    }))

    // Create a map from GitHub numeric ID to node_id for linking comments to reviews
    const reviewIdMap = new Map<number, string>()
    for (const review of reviews) {
      reviewIdMap.set(review.githubId, review.id)
    }

    for (const review of reviews) {
      await this.db
        .insert(schema.githubPrReview)
        .values(review)
        .onConflictDoUpdate({
          target: schema.githubPrReview.id,
          set: {
            state: review.state,
            body: review.body,
            submittedAt: review.submittedAt,
            updatedAt: new Date(),
          },
        })
    }

    // Fetch issue comments (general PR comments)
    const issueCommentsResponse = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(
      issueCommentsResponse.headers as Record<string, string | undefined>,
    )

    const issueComments = issueCommentsResponse.data.map((comment) => ({
      id: comment.node_id,
      githubId: comment.id,
      pullRequestId: pr.id,
      reviewId: null,
      commentType: "issue_comment",
      body: comment.body || null,
      authorLogin: comment.user?.login || null,
      authorAvatarUrl: comment.user?.avatar_url || null,
      htmlUrl: comment.html_url,
      path: null,
      line: null,
      side: null,
      diffHunk: null,
      githubCreatedAt: comment.created_at ? new Date(comment.created_at) : null,
      githubUpdatedAt: comment.updated_at ? new Date(comment.updated_at) : null,
      userId: this.userId,
    }))

    // Fetch review comments (inline diff comments)
    const reviewCommentsResponse = await this.octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(
      reviewCommentsResponse.headers as Record<string, string | undefined>,
    )

    const reviewComments = reviewCommentsResponse.data.map((comment) => ({
      id: comment.node_id,
      githubId: comment.id,
      pullRequestId: pr.id,
      // Map the numeric GitHub review ID to the actual review node_id
      reviewId: comment.pull_request_review_id
        ? (reviewIdMap.get(comment.pull_request_review_id) ?? null)
        : null,
      commentType: "review_comment",
      body: comment.body || null,
      authorLogin: comment.user?.login || null,
      authorAvatarUrl: comment.user?.avatar_url || null,
      htmlUrl: comment.html_url,
      path: comment.path,
      line: comment.line ?? comment.original_line ?? null,
      side: comment.side || null,
      diffHunk: comment.diff_hunk || null,
      githubCreatedAt: comment.created_at ? new Date(comment.created_at) : null,
      githubUpdatedAt: comment.updated_at ? new Date(comment.updated_at) : null,
      userId: this.userId,
    }))

    const allComments = [...issueComments, ...reviewComments]

    for (const comment of allComments) {
      await this.db
        .insert(schema.githubPrComment)
        .values(comment)
        .onConflictDoUpdate({
          target: schema.githubPrComment.id,
          set: {
            body: comment.body,
            githubUpdatedAt: comment.githubUpdatedAt,
            updatedAt: new Date(),
          },
        })
    }

    await this.updateSyncState("pr-detail", `${owner}/${repo}/${pullNumber}`, rateLimit)

    return { pr, files, reviews, comments: allComments, rateLimit }
  }

  // Get last rate limit info
  getLastRateLimit(): RateLimitInfo | null {
    return this.lastRateLimit
  }
}

// Factory function to create a GitHub client from session
export async function createGitHubClient(userId: string, pool: Pool): Promise<GitHubClient | null> {
  const db = drizzle(pool, { schema })

  // Get the GitHub access token from auth_account
  const accounts = await db
    .select()
    .from(schema.authAccount)
    .where(and(eq(schema.authAccount.userId, userId), eq(schema.authAccount.providerId, "github")))
    .limit(1)

  if (!accounts[0]?.accessToken) {
    return null
  }

  return new GitHubClient(accounts[0].accessToken, userId, pool)
}
