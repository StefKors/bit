/**
 * Shared mocks for API route tests.
 * Use these to mock GitHub API and InstantDB in route handler tests.
 */

import { vi } from "vitest"
import type { GitHubClient } from "@/lib/github-client"

export const mockRateLimit = {
  remaining: 4999,
  limit: 5000,
  reset: new Date("2025-01-01"),
  used: 1,
}

const toGitHubClient = (mock: Partial<GitHubClient>): GitHubClient => mock as never as GitHubClient

export const createMockGitHubClient = (overrides: Record<string, unknown> = {}): GitHubClient =>
  toGitHubClient({
    getRateLimit: vi.fn().mockResolvedValue(mockRateLimit),
    getTokenScopes: vi.fn().mockResolvedValue(["repo", "read:org", "read:user", "user:email"]),
    fetchRepoTree: vi.fn().mockResolvedValue({ count: 10, rateLimit: mockRateLimit }),
    fetchRepoCommits: vi.fn().mockResolvedValue({ count: 5, rateLimit: mockRateLimit }),
    fetchPullRequests: vi.fn().mockResolvedValue({
      data: [],
      rateLimit: mockRateLimit,
    }),
    fetchPullRequestDetails: vi.fn().mockResolvedValue({
      prId: "pr-1",
      rateLimit: mockRateLimit,
    }),
    fetchOrganizations: vi.fn().mockResolvedValue({ data: [], rateLimit: mockRateLimit }),
    fetchRepositories: vi.fn().mockResolvedValue({ data: [], rateLimit: mockRateLimit }),
    performInitialSync: vi.fn().mockResolvedValue({ synced: true }),
    registerRepoWebhook: vi.fn().mockResolvedValue({ status: "installed" }),
    registerAllWebhooks: vi.fn().mockResolvedValue({
      total: 1,
      installed: 1,
      noAccess: 0,
      errors: [],
      results: [],
    }),
    mergePullRequest: vi.fn().mockResolvedValue({
      merged: true,
      message: "Pull request successfully merged",
      sha: "abc123",
    }),
    updatePullRequestState: vi.fn().mockResolvedValue({
      number: 1,
      state: "closed",
      merged: false,
    }),
    updatePullRequest: vi.fn().mockResolvedValue({
      number: 1,
      title: "Updated title",
      body: "Updated body",
      state: "open",
      draft: false,
      githubUpdatedAt: Date.now(),
    }),
    deleteBranch: vi.fn().mockResolvedValue({ deleted: true }),
    restoreBranch: vi.fn().mockResolvedValue({
      restored: true,
      ref: "refs/heads/feature/test",
      sha: "abc123",
    }),
    createIssueComment: vi.fn().mockResolvedValue({
      id: 1,
      body: "Test comment",
      htmlUrl: "https://github.com/test/repo/pull/1#issuecomment-1",
    }),
    updateIssueComment: vi.fn().mockResolvedValue({
      id: 1,
      body: "Updated comment",
      htmlUrl: "https://github.com/test/repo/pull/1#issuecomment-1",
    }),
    deleteIssueComment: vi.fn().mockResolvedValue({ deleted: true }),
    createPullRequestReview: vi.fn().mockResolvedValue({
      id: 1,
      state: "COMMENTED",
      body: "Looks good",
      htmlUrl: "https://github.com/test/repo/pull/1#pullrequestreview-1",
    }),
    submitPullRequestReview: vi.fn().mockResolvedValue({
      id: 1,
      state: "COMMENTED",
      body: "Looks good",
      htmlUrl: "https://github.com/test/repo/pull/1#pullrequestreview-1",
    }),
    discardPendingReview: vi.fn().mockResolvedValue({
      discarded: true,
    }),
    requestReviewers: vi.fn().mockResolvedValue({
      requestedReviewers: ["reviewer-a"],
      requestedTeams: [],
    }),
    createReviewComment: vi.fn().mockResolvedValue({
      id: 1,
      body: "Inline comment",
      htmlUrl: "https://github.com/test/repo/pull/1#discussion_r1",
      path: "src/index.ts",
      line: 1,
      side: "RIGHT",
    }),
    updateReviewComment: vi.fn().mockResolvedValue({
      id: 1,
      resolved: true,
    }),
    createSuggestedChange: vi.fn().mockResolvedValue({
      id: 1,
      body: "```suggestion\nconst value = 1\n```",
      htmlUrl: "https://github.com/test/repo/pull/1#discussion_r1",
      path: "src/index.ts",
      line: 1,
      side: "RIGHT",
    }),
    ...overrides,
  })

const chainableTx = () => ({
  update: vi.fn().mockReturnValue({ link: vi.fn() }),
  delete: vi.fn(),
  link: vi.fn(),
})

export const createMockAdminDb = (
  queryData: {
    syncStates?: Array<{ id: string; lastEtag?: string }>
    repos?: Array<{ id: string; fullName: string }>
    webhookDeliveries?: Array<{ id: string; event: string; payload?: string }>
  } = {},
) => {
  const query = vi.fn().mockImplementation((q: Record<string, unknown>) => {
    const result: Record<string, unknown[]> = {}
    if (q.syncStates) result.syncStates = queryData.syncStates ?? []
    if (q.repos) result.repos = queryData.repos ?? []
    if (q.webhookDeliveries) result.webhookDeliveries = queryData.webhookDeliveries ?? []
    if (q.issues) result.issues = []
    if (q.issueComments) result.issueComments = []
    return Promise.resolve(result)
  })
  const transact = vi.fn().mockResolvedValue(undefined)
  const tx = new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: () => chainableTx(),
          },
        ),
    },
  )
  return { query, transact, tx }
}
