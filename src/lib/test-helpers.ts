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
    body: undefined as string | undefined,
    state: opts.state ?? "open",
    draft: opts.draft ?? false,
    merged: opts.merged ?? false,
    mergeable: undefined as boolean | undefined,
    mergeableState: undefined as string | undefined,
    authorLogin: "authorLogin" in opts ? (opts.authorLogin ?? undefined) : "user1",
    authorAvatarUrl: "authorAvatarUrl" in opts ? (opts.authorAvatarUrl ?? undefined) : undefined,
    headRef: "feature",
    headSha: "abc",
    baseRef: "main",
    baseSha: "def",
    htmlUrl: undefined as string | undefined,
    diffUrl: undefined as string | undefined,
    additions: undefined as number | undefined,
    deletions: undefined as number | undefined,
    changedFiles: undefined as number | undefined,
    commits: undefined as number | undefined,
    comments: opts.comments ?? 0,
    reviewComments: opts.reviewComments ?? 0,
    labels: "labels" in opts ? (opts.labels ?? undefined) : undefined,
    reviewRequestedBy: undefined as string | undefined,
    repoId: "repo-1",
    userId: "user-1",
    githubCreatedAt: opts.githubCreatedAt ?? 1700000000000,
    githubUpdatedAt: opts.githubUpdatedAt ?? 1700001000000,
    closedAt: undefined as number | undefined,
    mergedAt: opts.merged ? 1700002000000 : undefined,
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
    body: undefined as string | undefined,
    state: opts.state ?? "open",
    stateReason: undefined as string | undefined,
    authorLogin: "authorLogin" in opts ? (opts.authorLogin ?? undefined) : "user1",
    authorAvatarUrl: "authorAvatarUrl" in opts ? (opts.authorAvatarUrl ?? undefined) : undefined,
    htmlUrl: undefined as string | undefined,
    comments: opts.comments ?? 0,
    labels: "labels" in opts ? (opts.labels ?? undefined) : undefined,
    assignees: undefined as string | undefined,
    milestone: undefined as string | undefined,
    repoId: "repo-1",
    userId: "user-1",
    githubCreatedAt: opts.githubCreatedAt ?? 1700000000000,
    githubUpdatedAt: opts.githubUpdatedAt ?? 1700001000000,
    closedAt: undefined as number | undefined,
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

export const makeAuthRequest = (url: string, userId: string, opts: { method?: string } = {}) =>
  makeRequest(url, {
    method: opts.method,
    headers: { Authorization: `Bearer ${userId}` },
  })

export const parseJsonResponse = async <T = unknown>(
  response: Response,
): Promise<{ status: number; body: T }> => {
  const body = (await response.json()) as T
  return { status: response.status, body }
}

// ── Reset counters between tests ──

export const resetCounters = () => {
  prCounter = 0
  issueCounter = 0
  repoCounter = 0
}
