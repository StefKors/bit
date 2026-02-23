import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient, mockRateLimit } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

const { Route } = await import("./$owner.$repo.pull.$number")

describe("POST /api/github/sync/:owner/:repo/pull/:number", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchPullRequestDetails: vi.fn().mockResolvedValue({
          prId: "pr-123",
          rateLimit: mockRateLimit,
        }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/o/r/pull/1", { method: "POST" })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid pull number", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/pull/abc", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "abc" },
    })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Invalid pull request number")
  })

  it("returns prId on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/pull/42", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "42" },
    })
    const { status, body } = await parseJsonResponse<{ prId: string }>(res)

    expect(status).toBe(200)
    expect(body.prId).toBe("pr-123")
  })
})
