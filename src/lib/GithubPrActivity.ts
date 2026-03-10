import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"
import { getInstallationToken } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

const GITHUB_API = "https://api.github.com"
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: { date: string } | null
  }
  author: { login: string; avatar_url: string } | null
  html_url: string
}

interface GitHubIssueComment {
  id: number
  node_id: string
  body: string
  user: { login: string; avatar_url: string } | null
  html_url: string
  created_at: string
  updated_at: string
}

interface GitHubReview {
  id: number
  node_id: string
  state: string
  body: string | null
  user: { login: string; avatar_url: string } | null
  html_url: string
  submitted_at: string
}

interface GitHubReviewComment {
  id: number
  node_id: string
  body: string
  path: string
  line: number | null
  side: string
  in_reply_to_id?: number
  pull_request_review_id?: number | null
  user: { login: string; avatar_url: string } | null
  html_url: string
  created_at: string
  updated_at: string
}

async function githubFetchPaginated<T>(token: string, url: string, maxPages = 15): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = url

  let lastUrl = url
  for (let page = 0; page < maxPages && nextUrl; page++) {
    lastUrl = nextUrl
    const response = await fetch(nextUrl, {
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      log.warn("GitHub API fetch failed", {
        url: nextUrl,
        status: response.status,
      })
      break
    }

    const data = (await response.json()) as T[]
    results.push(...data)

    const linkHeader = response.headers.get("link")
    nextUrl = parseLinkNext(linkHeader)
  }

  if (nextUrl) {
    log.warn("GitHub API pagination truncated", {
      url: lastUrl,
      maxPages,
      itemsFetched: results.length,
    })
  }

  return results
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader)
  return match?.[1] ?? null
}

async function fetchPRCommits(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubCommit[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=100`
  return githubFetchPaginated<GitHubCommit>(token, url)
}

async function fetchIssueComments(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GitHubIssueComment[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`
  return githubFetchPaginated<GitHubIssueComment>(token, url)
}

async function fetchPullReviews(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubReview[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`
  return githubFetchPaginated<GitHubReview>(token, url)
}

async function fetchPullReviewComments(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubReviewComment[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100`
  return githubFetchPaginated<GitHubReviewComment>(token, url)
}

function parseTimestamp(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function upsertCommits(params: {
  pullRequestId: string
  commits: GitHubCommit[]
  pushEventId?: string
  pushCommitShas?: Set<string>
}): Promise<void> {
  const { pullRequestId, commits, pushEventId, pushCommitShas } = params
  if (commits.length === 0) return
  const now = Date.now()
  const shas = commits.map((c) => c.sha)

  const { pullRequests } = await adminDb.query({
    pullRequests: {
      $: { where: { id: pullRequestId }, limit: 1 },
      pullRequestCommits: {
        $: { where: { sha: { $in: shas } } },
      },
    },
  })

  const pr = pullRequests?.[0]
  const existing = pr?.pullRequestCommits ?? []
  const existingBySha = new Map(existing.map((e) => [e.sha, e]))

  const txs = commits.map((commit) => {
    const found = existingBySha.get(commit.sha)
    const firstLine = commit.commit.message.split("\n")[0] ?? ""
    const update = {
      sha: commit.sha,
      message: commit.commit.message,
      messageShort: firstLine.slice(0, 120),
      authorLogin: commit.author?.login ?? undefined,
      authorAvatarUrl: commit.author?.avatar_url ?? undefined,
      authoredAt: parseTimestamp(commit.commit.author?.date),
      htmlUrl: commit.html_url,
      createdAt: found?.createdAt ?? now,
      updatedAt: now,
    }

    const shouldLinkPushEvent = Boolean(pushEventId) && Boolean(pushCommitShas?.has(commit.sha))

    if (found) {
      const tx = adminDb.tx.pullRequestCommits[found.id]
        .update(update)
        .link({ pullRequest: pullRequestId })
      return shouldLinkPushEvent && pushEventId ? tx.link({ pushEvent: pushEventId }) : tx
    }

    const tx = adminDb.tx.pullRequestCommits[id()]
      .update(update)
      .link({ pullRequest: pullRequestId })
    return shouldLinkPushEvent && pushEventId ? tx.link({ pushEvent: pushEventId }) : tx
  })

  await adminDb.transact(txs)
}

async function upsertIssueCommentsFromApi(
  pullRequestId: string,
  comments: GitHubIssueComment[],
): Promise<void> {
  if (comments.length === 0) return
  const now = Date.now()

  const { issueComments: existing } = await adminDb.query({
    issueComments: {
      $: {
        where: {
          githubId: { $in: comments.map((c) => c.id) },
        },
      },
    },
  })

  const existingByGithubId = new Map(existing.map((e) => [e.githubId, e]))

  const txs = comments.map((comment) => {
    const found = existingByGithubId.get(comment.id)
    const update = {
      githubId: comment.id,
      nodeId: comment.node_id,
      body: comment.body,
      authorLogin: comment.user?.login ?? undefined,
      authorAvatarUrl: comment.user?.avatar_url ?? undefined,
      htmlUrl: comment.html_url,
      createdAt: found?.createdAt ?? parseTimestamp(comment.created_at) ?? now,
      updatedAt: parseTimestamp(comment.updated_at) ?? now,
    }

    if (found) {
      return adminDb.tx.issueComments[found.id].update(update)
    }
    return adminDb.tx.issueComments[id()].update(update).link({ pullRequest: pullRequestId })
  })

  await adminDb.transact(txs)
}

async function upsertReviewsFromApi(pullRequestId: string, reviews: GitHubReview[]): Promise<void> {
  if (reviews.length === 0) return
  const now = Date.now()

  const { pullRequestReviews: existing } = await adminDb.query({
    pullRequestReviews: {
      $: {
        where: {
          githubId: { $in: reviews.map((r) => r.id) },
        },
      },
    },
  })

  const existingByGithubId = new Map(existing.map((e) => [e.githubId, e]))

  const txs = reviews.map((review) => {
    const found = existingByGithubId.get(review.id)
    const update = {
      githubId: review.id,
      nodeId: review.node_id,
      state: review.state,
      body: review.body ?? undefined,
      authorLogin: review.user?.login ?? undefined,
      authorAvatarUrl: review.user?.avatar_url ?? undefined,
      submittedAt: parseTimestamp(review.submitted_at),
      htmlUrl: review.html_url,
      createdAt: found?.createdAt ?? now,
      updatedAt: now,
    }

    if (found) {
      return adminDb.tx.pullRequestReviews[found.id].update(update)
    }
    return adminDb.tx.pullRequestReviews[id()].update(update).link({ pullRequest: pullRequestId })
  })

  await adminDb.transact(txs)
}

async function upsertReviewCommentsFromApi(
  pullRequestId: string,
  comments: GitHubReviewComment[],
): Promise<void> {
  if (comments.length === 0) return
  const now = Date.now()

  const { pullRequestReviewComments: existing } = await adminDb.query({
    pullRequestReviewComments: {
      $: {
        where: {
          githubId: { $in: comments.map((c) => c.id) },
        },
      },
    },
  })

  const existingByGithubId = new Map(existing.map((e) => [e.githubId, e]))

  const txs = comments.map((comment) => {
    const found = existingByGithubId.get(comment.id)
    const update = {
      githubId: comment.id,
      nodeId: comment.node_id,
      body: comment.body,
      path: comment.path,
      line: comment.line ?? undefined,
      side: comment.side,
      inReplyToId: comment.in_reply_to_id ?? undefined,
      pullRequestReviewId: comment.pull_request_review_id ?? undefined,
      authorLogin: comment.user?.login ?? undefined,
      authorAvatarUrl: comment.user?.avatar_url ?? undefined,
      htmlUrl: comment.html_url,
      createdAt: found?.createdAt ?? parseTimestamp(comment.created_at) ?? now,
      updatedAt: parseTimestamp(comment.updated_at) ?? now,
    }

    if (found) {
      return adminDb.tx.pullRequestReviewComments[found.id].update(update)
    }
    return adminDb.tx.pullRequestReviewComments[id()]
      .update(update)
      .link({ pullRequest: pullRequestId })
  })

  await adminDb.transact(txs)
}

export async function syncPRActivity(params: {
  pullRequestId: string
  repoFullName: string
  installationId: number
  prNumber: number
  pushEventId?: string
  pushCommitShas?: Set<string>
}): Promise<void> {
  const { pullRequestId, repoFullName, installationId, prNumber, pushEventId, pushCommitShas } =
    params
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) {
    log.warn("syncPRActivity: invalid repoFullName", { repoFullName })
    return
  }

  const token = await getInstallationToken(installationId)
  if (!token) {
    log.warn("syncPRActivity: no installation token", { installationId })
    return
  }

  const [commits, issueComments, reviews, reviewComments] = await Promise.all([
    fetchPRCommits(token, owner, repo, prNumber),
    fetchIssueComments(token, owner, repo, prNumber),
    fetchPullReviews(token, owner, repo, prNumber),
    fetchPullReviewComments(token, owner, repo, prNumber),
  ])

  await Promise.all([
    upsertCommits({
      pullRequestId,
      commits,
      pushEventId,
      pushCommitShas,
    }),
    upsertIssueCommentsFromApi(pullRequestId, issueComments),
    upsertReviewsFromApi(pullRequestId, reviews),
    upsertReviewCommentsFromApi(pullRequestId, reviewComments),
  ])

  log.info("syncPRActivity: completed", {
    pullRequestId,
    prNumber,
    commits: commits.length,
    issueComments: issueComments.length,
    reviews: reviews.length,
    reviewComments: reviewComments.length,
  })
}

export async function syncPRActivitySafely(params: {
  pullRequestId: string
  repoFullName: string
  installationId: number
  prNumber: number
  pushEventId?: string
  pushCommitShas?: Set<string>
}): Promise<void> {
  try {
    await syncPRActivity(params)
  } catch (error) {
    log.error("syncPRActivity failed", error, {
      pullRequestId: params.pullRequestId,
      prNumber: params.prNumber,
    })
  }
}
