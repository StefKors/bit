import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn(),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnValue({
                  link: vi.fn().mockReturnThis(),
                }),
              }),
            },
          ),
      },
    ),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./checks.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/checks/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
  })

  it("returns checks from local database when available", async () => {
    const mockListCheckRuns = vi.fn()
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ listCheckRuns: mockListCheckRuns }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1", headSha: "abc123" }] })
      .mockResolvedValueOnce({
        prChecks: [
          {
            githubId: 1,
            name: "CI / test",
            status: "completed",
            conclusion: "success",
            detailsUrl: "https://example.com/check/1",
            htmlUrl: "https://github.com/test/repo/actions/runs/1",
            startedAt: 1700000000000,
            completedAt: 1700000100000,
          },
        ],
      })

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/checks/test-owner/test-repo/1",
      "test-user-id",
      { method: "GET" },
    )
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    const { body } = await parseJsonResponse<{ checks: Array<{ name: string }> }>(response)
    expect(body.checks).toHaveLength(1)
    expect(body.checks[0]?.name).toBe("CI / test")
    expect(mockListCheckRuns).not.toHaveBeenCalled()
  })

  it("fetches checks from GitHub when local checks are missing", async () => {
    const mockListCheckRuns = vi.fn().mockResolvedValue({
      checks: [
        {
          githubId: 2,
          name: "CI / lint",
          status: "completed",
          conclusion: "success",
          detailsUrl: null,
          htmlUrl: "https://github.com/test/repo/actions/runs/2",
          startedAt: 1700000200000,
          completedAt: 1700000300000,
        },
      ],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ listCheckRuns: mockListCheckRuns }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1", headSha: "abc123" }] })
      .mockResolvedValueOnce({ prChecks: [] })
      .mockResolvedValueOnce({ prChecks: [] })

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/checks/test-owner/test-repo/1",
      "test-user-id",
      { method: "GET" },
    )
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockListCheckRuns).toHaveBeenCalledWith("test-owner", "test-repo", "abc123")
    const { body } = await parseJsonResponse<{ checks: Array<{ name: string }> }>(response)
    expect(body.checks).toHaveLength(1)
    expect(body.checks[0]?.name).toBe("CI / lint")
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")
    const request = makeRequest("http://localhost/api/github/checks/test-owner/test-repo/1", {
      method: "GET",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
