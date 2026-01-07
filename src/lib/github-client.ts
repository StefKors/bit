import { Octokit } from "octokit"
import { id } from "@instantdb/admin"
import { adminDb } from "./instantAdmin"
import { findOrCreateSyncStateId } from "./sync-state"

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
    // Use paginate to fetch all organizations
    const allOrgsData = await this.octokit.paginate(
      this.octokit.rest.orgs.listForAuthenticatedUser,
      { per_page: 100 },
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

    // Upsert organizations - check if exists first, then update or create
    for (const org of orgs) {
      const { organizations: existing } = await adminDb.query({
        organizations: {
          $: { where: { githubId: org.githubId } },
        },
      })

      const orgId = existing?.[0]?.id || id()

      await adminDb.transact(
        adminDb.tx.organizations[orgId]
          .update({
            githubId: org.githubId,
            login: org.login,
            name: org.name,
            description: org.description,
            avatarUrl: org.avatarUrl,
            url: org.url,
            syncedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId }),
      )
    }

    await this.updateSyncState("orgs", null, rateLimit)

    return { data: orgs, rateLimit, fromCache: false }
  }

  // Fetch user's repositories (personal and org repos) with pagination
  async fetchRepositories(): Promise<SyncResult<{ githubId: number; fullName: string }[]>> {
    // Use paginate to fetch all repositories
    const allReposData = await this.octokit.paginate(
      this.octokit.rest.repos.listForAuthenticatedUser,
      {
        per_page: 100,
        sort: "updated",
        affiliation: "owner,collaborator,organization_member",
      },
    )

    // Get rate limit from a simple request
    const rateLimit = await this.getRateLimit()

    const now = Date.now()
    const repos = allReposData.map((repo) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
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

    // Upsert repositories - check if exists first, then update or create
    for (const repo of repos) {
      const { repos: existing } = await adminDb.query({
        repos: {
          $: { where: { githubId: repo.githubId } },
        },
      })

      const repoId = existing?.[0]?.id || id()

      await adminDb.transact(
        adminDb.tx.repos[repoId]
          .update({
            ...repo,
            userId: this.userId, // Required attribute
            syncedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId }),
      )
    }

    await this.updateSyncState("repos", null, rateLimit)

    return { data: repos, rateLimit, fromCache: false }
  }

  // Fetch pull requests for a repository (with pagination)
  async fetchPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all",
  ): Promise<SyncResult<{ githubId: number; number: number }[]>> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    // Use paginate to fetch all pull requests
    const allPrsData = await this.octokit.paginate(this.octokit.rest.pulls.list, {
      owner,
      repo,
      state,
      per_page: 100,
      sort: "updated",
      direction: "desc",
    })

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

    // Upsert pull requests - check if exists first, then update or create
    for (const pr of prs) {
      const { pullRequests: existing } = await adminDb.query({
        pullRequests: {
          $: { where: { githubId: pr.githubId } },
        },
      })

      const prId = existing?.[0]?.id || id()

      await adminDb.transact(
        adminDb.tx.pullRequests[prId]
          .update({
            ...pr,
            repoId: repoRecord.id, // Required attribute
            userId: this.userId, // Required attribute
            syncedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ repo: repoRecord.id }),
      )
    }

    await this.updateSyncState("pulls", `${owner}/${repo}`, rateLimit)

    return { data: prs, rateLimit, fromCache: false }
  }

  // Fetch detailed PR info including files, comments, reviews, commits, and events
  async fetchPullRequestDetails(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{
    prId: string
    rateLimit: RateLimitInfo
  }> {
    const repoRecord = await this.ensureRepoRecord(owner, repo)

    // Fetch PR details
    const prResponse = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    })

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

    // Fetch files (with pagination)
    const allFiles = await this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })

    for (const file of allFiles) {
      const fileId = id()
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
            pullRequestId: prId, // Required attribute
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Fetch reviews (with pagination)
    const allReviews = await this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })

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

    // Fetch issue comments (with pagination)
    const allIssueComments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    })

    for (const comment of allIssueComments) {
      const commentId = id()
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
            pullRequestId: prId, // Required attribute
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Fetch review comments (with pagination)
    const allReviewComments = await this.octokit.paginate(
      this.octokit.rest.pulls.listReviewComments,
      {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      },
    )

    for (const comment of allReviewComments) {
      const reviewId = comment.pull_request_review_id
        ? reviewIdMap.get(comment.pull_request_review_id)
        : undefined

      const commentId = id()
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
          pullRequestId: prId, // Required attribute
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

    // Fetch commits (with pagination)
    const allCommits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })

    for (const commit of allCommits) {
      const commitId = `${prId}:${commit.sha}`
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

    const response = await this.octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "1",
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)
    const now = Date.now()

    for (const item of response.data.tree) {
      if (!item.path) continue

      const pathParts = item.path.split("/")
      const name = pathParts[pathParts.length - 1]
      const entryId = id()

      await adminDb.transact(
        adminDb.tx.repoTrees[entryId]
          .update({
            ref: branch,
            path: item.path,
            name,
            type: item.type === "tree" ? "dir" : "file",
            sha: item.sha || "",
            size: item.size || undefined,
            url: item.url || undefined,
            htmlUrl: `https://github.com/${owner}/${repo}/${item.type === "tree" ? "tree" : "blob"}/${branch}/${item.path}`,
            repoId: repoRecord.id, // Required attribute
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ repo: repoRecord.id }),
      )
    }

    await this.updateSyncState("tree", `${owner}/${repo}:${branch}`, rateLimit)

    return { count: response.data.tree.length, rateLimit }
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
    const webhookUrl = process.env.BASE_URL ? `${process.env.BASE_URL}/api/github/webhook` : null
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
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

    if (!webhookUrl || !webhookSecret) {
      const error = "BASE_URL or GITHUB_WEBHOOK_SECRET not configured"
      console.log(`Skipping webhook registration for ${fullName}: ${error}`)
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.NOT_INSTALLED, error)
      return { success: false, status: GitHubClient.WEBHOOK_STATUS.NOT_INSTALLED, error }
    }

    try {
      // Check if webhook already exists (with pagination)
      const existingHooks = await this.octokit.paginate(this.octokit.rest.repos.listWebhooks, {
        owner,
        repo,
        per_page: 100,
      })

      const existingHook = existingHooks.find((hook) => hook.config.url === webhookUrl)

      if (existingHook) {
        console.log(`Webhook already exists for ${fullName}`)
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

      console.log(`Webhook registered for ${fullName}`)
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.INSTALLED)
      return { success: true, status: GitHubClient.WEBHOOK_STATUS.INSTALLED }
    } catch (err) {
      const error = err as { status?: number; message?: string; response?: { data?: { message?: string; errors?: Array<{ message?: string }> } } }
      const errorMessage = error.response?.data?.message || error.message || "unknown error"

      // 422 with "Hook already exists" means webhook is already installed (possibly with different config)
      if (error.status === 422 && errorMessage.includes("Hook already exists")) {
        console.log(`Webhook already exists for ${fullName} (different config)`)
        await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.INSTALLED)
        return { success: true, status: GitHubClient.WEBHOOK_STATUS.INSTALLED }
      }

      // 404 or 403 means we don't have permission - that's expected for repos we don't own
      if (error.status === 404 || error.status === 403) {
        console.log(`Cannot register webhook for ${fullName}: ${errorMessage} (status: ${error.status})`)
        await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.NO_ACCESS, errorMessage)
        return { success: false, status: GitHubClient.WEBHOOK_STATUS.NO_ACCESS, error: errorMessage }
      }

      console.error(`Error registering webhook for ${fullName}:`, errorMessage, err)
      await updateWebhookStatus(GitHubClient.WEBHOOK_STATUS.ERROR, errorMessage)
      return { success: false, status: GitHubClient.WEBHOOK_STATUS.ERROR, error: errorMessage }
    }
  }

  // Register webhooks for all repos belonging to this user
  async registerAllWebhooks(): Promise<{
    total: number
    installed: number
    noAccess: number
    errors: number
    results: Array<{ fullName: string; status: string; error?: string }>
  }> {
    // Get all repos for this user
    const { repos } = await adminDb.query({
      repos: { $: { where: { userId: this.userId } } },
    })

    const results: Array<{ fullName: string; status: string; error?: string }> = []
    let installed = 0
    let noAccess = 0
    let errors = 0

    for (const repo of repos || []) {
      const [owner, repoName] = repo.fullName.split("/")
      const result = await this.registerRepoWebhook(owner, repoName)
      results.push({ fullName: repo.fullName, status: result.status, error: result.error })

      if (result.status === GitHubClient.WEBHOOK_STATUS.INSTALLED) {
        installed++
      } else if (result.status === GitHubClient.WEBHOOK_STATUS.NO_ACCESS) {
        noAccess++
      } else {
        errors++
      }
    }

    return {
      total: repos?.length || 0,
      installed,
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

  // Perform initial sync after OAuth: orgs, repos, and webhooks
  async performInitialSync(): Promise<{
    orgs: number
    repos: number
    webhooks: number
    openPRs: number
  }> {
    console.log(`Starting initial sync for user ${this.userId}`)

    try {
      // Log token scopes for debugging
      const scopes = await this.getTokenScopes()
      console.log(`Token scopes: ${scopes.join(", ") || "(none)"}`)

      // 1. Sync organizations
      await this.updateInitialSyncProgress({ step: "orgs" })
      const orgsResult = await this.fetchOrganizations()
      console.log(`Synced ${orgsResult.data.length} organizations`)

      // 2. Sync repositories
      await this.updateInitialSyncProgress({
        step: "repos",
        orgs: { total: orgsResult.data.length },
      })
      const reposResult = await this.fetchRepositories()
      console.log(`Synced ${reposResult.data.length} repositories`)

      // 3. Register webhooks for repos we can admin
      let webhooksRegistered = 0
      const totalRepos = reposResult.data.length
      for (let i = 0; i < reposResult.data.length; i++) {
        const repo = reposResult.data[i]
        await this.updateInitialSyncProgress({
          step: "webhooks",
          orgs: { total: orgsResult.data.length },
          repos: { total: reposResult.data.length },
          webhooks: { completed: i, total: totalRepos },
        })
        const [owner, repoName] = repo.fullName.split("/")
        const result = await this.registerRepoWebhook(owner, repoName)
        if (result.success) webhooksRegistered++
      }
      console.log(`Registered webhooks for ${webhooksRegistered} repositories`)

      // 4. Sync open PRs for all repos (limit to first 10 repos to avoid rate limiting)
      let totalOpenPRs = 0
      const reposToSync = reposResult.data.slice(0, 10) // Limit to avoid rate limiting
      for (let i = 0; i < reposToSync.length; i++) {
        const repo = reposToSync[i]
        await this.updateInitialSyncProgress({
          step: "pullRequests",
          orgs: { total: orgsResult.data.length },
          repos: { total: reposResult.data.length },
          webhooks: { completed: totalRepos, total: totalRepos },
          pullRequests: { completed: i, total: reposToSync.length, prsFound: totalOpenPRs },
        })
        try {
          const [owner, repoName] = repo.fullName.split("/")
          const prsResult = await this.fetchPullRequests(owner, repoName, "open")
          totalOpenPRs += prsResult.data.length
        } catch (err) {
          console.error(`Error syncing PRs for ${repo.fullName}:`, err)
        }
      }
      console.log(`Synced ${totalOpenPRs} open PRs from ${reposToSync.length} repositories`)

      // Mark as completed
      await this.updateInitialSyncProgress({
        step: "completed",
        orgs: { total: orgsResult.data.length },
        repos: { total: reposResult.data.length },
        webhooks: { completed: webhooksRegistered, total: totalRepos },
        pullRequests: {
          completed: reposToSync.length,
          total: reposToSync.length,
          prsFound: totalOpenPRs,
        },
      })

      return {
        orgs: orgsResult.data.length,
        repos: reposResult.data.length,
        webhooks: webhooksRegistered,
        openPRs: totalOpenPRs,
      }
    } catch (err) {
      // Update with error status
      await this.updateInitialSyncProgress({
        step: "orgs",
        error: err instanceof Error ? err.message : "Initial sync failed",
      })
      throw err
    }
  }
}

// Factory function to create a GitHub client from session
export async function createGitHubClient(userId: string): Promise<GitHubClient | null> {
  try {
    // Query for the user's stored GitHub access token by fields
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
    const accessToken = tokenState?.lastEtag // Token stored in lastEtag field

    if (accessToken) {
      return new GitHubClient(accessToken, userId)
    }

    // Fall back to environment variable for backward compatibility or global token
    const globalToken = process.env.GITHUB_ACCESS_TOKEN
    if (globalToken) {
      console.log("Using global GitHub access token (user token not found)")
      return new GitHubClient(globalToken, userId)
    }

    console.error("No GitHub access token available for user:", userId)
    return null
  } catch (err) {
    console.error("Error fetching GitHub token for user:", userId, err)

    // Fall back to environment variable
    const globalToken = process.env.GITHUB_ACCESS_TOKEN
    if (globalToken) {
      return new GitHubClient(globalToken, userId)
    }

    return null
  }
}
