/**
 * Shared test helpers for mocking InstantDB and GitHub API responses.
 * Import these in test files to keep setup clean and reproducible.
 */

// ── Mock PR factory ──

interface MockPROptions {
  id?: string
  number?: number
  title?: string
  state?: string
  draft?: boolean
  merged?: boolean
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  labels?: string | null
  comments?: number | null
  reviewComments?: number | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
}

let prCounter = 0

export const makePR = (opts: MockPROptions = {}) => {
  prCounter++
  return {
    id: opts.id ?? `pr-${prCounter}`,
    githubId: prCounter,
    number: opts.number ?? prCounter,
    title: opts.title ?? `PR #${prCounter}`,
    body: null,
    state: opts.state ?? "open",
    draft: opts.draft ?? false,
    merged: opts.merged ?? false,
    mergeable: null,
    mergeableState: null,
    authorLogin: opts.authorLogin ?? "user1",
    authorAvatarUrl: opts.authorAvatarUrl ?? null,
    headRef: "feature",
    headSha: "abc",
    baseRef: "main",
    baseSha: "def",
    htmlUrl: null,
    diffUrl: null,
    additions: null,
    deletions: null,
    changedFiles: null,
    commits: null,
    comments: opts.comments ?? 0,
    reviewComments: opts.reviewComments ?? 0,
    labels: opts.labels ?? null,
    reviewRequestedBy: null,
    repoId: "repo-1",
    userId: "user-1",
    githubCreatedAt: opts.githubCreatedAt ?? 1700000000000,
    githubUpdatedAt: opts.githubUpdatedAt ?? 1700001000000,
    closedAt: null,
    mergedAt: opts.merged ? 1700002000000 : null,
    syncedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }
}

// ── Mock Issue factory ──

interface MockIssueOptions {
  id?: string
  number?: number
  title?: string
  state?: string
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  labels?: string | null
  comments?: number | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
}

let issueCounter = 0

export const makeIssue = (opts: MockIssueOptions = {}) => {
  issueCounter++
  return {
    id: opts.id ?? `issue-${issueCounter}`,
    githubId: issueCounter,
    number: opts.number ?? issueCounter,
    title: opts.title ?? `Issue #${issueCounter}`,
    body: null,
    state: opts.state ?? "open",
    stateReason: null,
    authorLogin: opts.authorLogin ?? "user1",
    authorAvatarUrl: opts.authorAvatarUrl ?? null,
    htmlUrl: null,
    comments: opts.comments ?? 0,
    labels: opts.labels ?? null,
    assignees: null,
    milestone: null,
    repoId: "repo-1",
    userId: "user-1",
    githubCreatedAt: opts.githubCreatedAt ?? 1700000000000,
    githubUpdatedAt: opts.githubUpdatedAt ?? 1700001000000,
    closedAt: null,
    syncedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }
}

// ── Mock Repo factory ──

interface MockRepoOptions {
  id?: string
  name?: string
  owner?: string
  fork?: boolean
  language?: string | null
  stargazersCount?: number | null
  forksCount?: number | null
  githubUpdatedAt?: number | null
}

let repoCounter = 0

export const makeRepo = (opts: MockRepoOptions = {}) => {
  repoCounter++
  const name = opts.name ?? `repo-${repoCounter}`
  const owner = opts.owner ?? "testuser"
  return {
    id: opts.id ?? `repo-${repoCounter}`,
    name,
    fullName: `${owner}/${name}`,
    owner,
    fork: opts.fork ?? false,
    language: opts.language ?? null,
    stargazersCount: opts.stargazersCount ?? 0,
    forksCount: opts.forksCount ?? 0,
    githubUpdatedAt: opts.githubUpdatedAt ?? 1700000000000,
  }
}

// ── Mock API route handler context ──

export const makeRequest = (
  url: string,
  opts: { method?: string; headers?: Record<string, string> } = {},
) =>
  new Request(url, {
    method: opts.method ?? "GET",
    headers: new Headers(opts.headers ?? {}),
  })

export const makeAuthRequest = (
  url: string,
  userId: string,
  opts: { method?: string } = {},
) =>
  makeRequest(url, {
    method: opts.method,
    headers: { Authorization: `Bearer ${userId}` },
  })

export const parseJsonResponse = async <T = unknown>(response: Response): Promise<{ status: number; body: T }> => {
  const body = (await response.json()) as T
  return { status: response.status, body }
}

// ── Reset counters between tests ──

export const resetCounters = () => {
  prCounter = 0
  issueCounter = 0
  repoCounter = 0
}
