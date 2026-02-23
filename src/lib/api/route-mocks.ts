/**
 * Shared mocks for API route tests.
 * Use these to mock GitHub API and InstantDB in route handler tests.
 */

import { vi } from "vitest"

export const mockRateLimit = {
  remaining: 4999,
  limit: 5000,
  reset: new Date("2025-01-01"),
  used: 1,
}

export const createMockGitHubClient = (overrides: Record<string, unknown> = {}) => ({
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
  const query = vi.fn().mockImplementation(async (q: Record<string, unknown>) => {
    const result: Record<string, unknown[]> = {}
    if (q.syncStates) result.syncStates = queryData.syncStates ?? []
    if (q.repos) result.repos = queryData.repos ?? []
    if (q.webhookDeliveries) result.webhookDeliveries = queryData.webhookDeliveries ?? []
    if (q.issues) result.issues = []
    if (q.issueComments) result.issueComments = []
    return result
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
