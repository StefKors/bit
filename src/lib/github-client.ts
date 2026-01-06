import { Octokit } from "octokit"
import { id } from "@instantdb/admin"
import { adminDb } from "./instantAdmin"

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

  // Update sync state in database
  async updateSyncState(
    resourceType: string,
    resourceId: string | null,
    rateLimit: RateLimitInfo,
    status: "idle" | "syncing" | "error" = "idle",
    error?: string,
    etag?: string,
  ) {
    const stateId = `${this.userId}:${resourceType}${resourceId ? `:${resourceId}` : ""}`
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
          updatedAt: now,
        })
        .link({ user: this.userId }),
    )
  }

  private async ensureRepoRecord(owner: string, repo: string) {
    const fullName = `${owner}/${repo}`

    // Check if repo already exists
    const { repos } = await adminDb.query({
      repos: {
        $: { where: { fullName } },
      },
    })

    if (repos && repos.length > 0) {
      return repos[0]
    }

    // Fetch from GitHub
    const response = await this.octokit.rest.repos.get({ owner, repo })
    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const repoData = response.data
    const now = Date.now()
    const repoId = repoData.node_id

    await adminDb.transact(
      adminDb.tx.repos[repoId]
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
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId }),
    )

    await this.updateSyncState("repo", fullName, rateLimit)

    // Return with our string ID (node_id) for InstantDB
    return { ...repoData, id: repoId, defaultBranch: repoData.default_branch || "main" }
  }

  // Fetch user's organizations
  async fetchOrganizations(): Promise<SyncResult<{ id: string; login: string }[]>> {
    const response = await this.octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100,
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const now = Date.now()
    const orgs = response.data.map((org) => ({
      id: org.node_id,
      githubId: org.id,
      login: org.login,
      name: org.login,
      description: org.description || undefined,
      avatarUrl: org.avatar_url,
      url: org.url,
    }))

    // Upsert organizations using InstantDB
    for (const org of orgs) {
      await adminDb.transact(
        adminDb.tx.organizations[org.id]
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

  // Fetch user's repositories (personal and org repos)
  async fetchRepositories(): Promise<SyncResult<{ id: string; fullName: string }[]>> {
    const response = await this.octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    })

    const rateLimit = this.extractRateLimit(response.headers as Record<string, string | undefined>)

    const now = Date.now()
    const repos = response.data.map((repo) => ({
      id: repo.node_id,
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

    // Upsert repositories using InstantDB
    for (const repo of repos) {
      await adminDb.transact(
        adminDb.tx.repos[repo.id]
          .update({
            ...repo,
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

  // Fetch pull requests for a repository
  async fetchPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all",
  ): Promise<SyncResult<{ id: string; number: number }[]>> {
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

    const now = Date.now()
    const prs = response.data.map((pr) => ({
      id: pr.node_id,
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

    // Upsert pull requests using InstantDB
    for (const pr of prs) {
      await adminDb.transact(
        adminDb.tx.pullRequests[pr.id]
          .update({
            ...pr,
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

    let rateLimit = this.extractRateLimit(prResponse.headers as Record<string, string | undefined>)
    const prData = prResponse.data

    const now = Date.now()
    const prId = prData.node_id

    // Upsert PR
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
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .link({ user: this.userId })
        .link({ repo: repoRecord.id }),
    )

    // Fetch files
    const filesResponse = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(filesResponse.headers as Record<string, string | undefined>)

    for (const file of filesResponse.data) {
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
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Fetch reviews
    const reviewsResponse = await this.octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(reviewsResponse.headers as Record<string, string | undefined>)

    const reviewIdMap = new Map<number, string>()
    for (const review of reviewsResponse.data) {
      reviewIdMap.set(review.id, review.node_id)

      await adminDb.transact(
        adminDb.tx.prReviews[review.node_id]
          .update({
            githubId: review.id,
            state: review.state,
            body: review.body || undefined,
            authorLogin: review.user?.login || undefined,
            authorAvatarUrl: review.user?.avatar_url || undefined,
            htmlUrl: review.html_url,
            submittedAt: review.submitted_at ? new Date(review.submitted_at).getTime() : undefined,
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Fetch issue comments
    const issueCommentsResponse = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(
      issueCommentsResponse.headers as Record<string, string | undefined>,
    )

    for (const comment of issueCommentsResponse.data) {
      await adminDb.transact(
        adminDb.tx.prComments[comment.node_id]
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
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

    // Fetch review comments
    const reviewCommentsResponse = await this.octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    rateLimit = this.extractRateLimit(
      reviewCommentsResponse.headers as Record<string, string | undefined>,
    )

    for (const comment of reviewCommentsResponse.data) {
      const reviewId = comment.pull_request_review_id
        ? reviewIdMap.get(comment.pull_request_review_id)
        : undefined

      const tx = adminDb.tx.prComments[comment.node_id]
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

    // Fetch commits
    const commitsResponse = await this.octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 250,
    })
    rateLimit = this.extractRateLimit(commitsResponse.headers as Record<string, string | undefined>)

    for (const commit of commitsResponse.data) {
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
            createdAt: now,
            updatedAt: now,
          })
          .link({ user: this.userId })
          .link({ pullRequest: prId }),
      )
    }

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
      const entryId = `${repoRecord.id}:${branch}:${item.path}`

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
}

// Factory function to create a GitHub client from session
export async function createGitHubClient(userId: string): Promise<GitHubClient | null> {
  // Try to get the user's stored GitHub access token
  const tokenStateId = `${userId}:github:token`

  try {
    const { syncStates } = await adminDb.query({
      syncStates: {
        $: {
          where: {
            id: tokenStateId,
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
