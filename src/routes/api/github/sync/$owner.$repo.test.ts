import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import { makeAuthRequest, makeRequest, parseJsonResponse } from "@/lib/test-helpers"
import { createMockGitHubClient, mockRateLimit } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { Route } = await import("./$owner.$repo")

describe("POST /api/github/sync/:owner/:repo", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchPullRequests: vi.fn().mockResolvedValue({
          data: [{ id: "pr-1" }],
          rateLimit: mockRateLimit,
        }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/o/r", { method: "POST" })
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    expect(res.status).toBe(401)
  })

  it("returns pull request count on success", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r", "user-1", {
      method: "POST",
    })
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    const { status, body } = await parseJsonResponse<{ pullRequests: number }>(res)

    expect(status).toBe(200)
    expect(body.pullRequests).toBe(1)
  })
})
