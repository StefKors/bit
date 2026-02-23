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

const { Route } = await import("./$owner.$repo.tree")

describe("POST /api/github/sync/:owner/:repo/tree", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchRepoTree: vi.fn().mockResolvedValue({ count: 10, rateLimit: mockRateLimit }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/o/r/tree", { method: "POST" })
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    expect(res.status).toBe(401)
  })

  it("returns 400 when client creation fails", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(null)

    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    expect(res.status).toBe(400)
  })

  it("returns count and rateLimit on success", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    const { status, body } = await parseJsonResponse<{ count: number }>(res)

    expect(status).toBe(200)
    expect(body.count).toBe(10)
  })

  it("passes ref query param", async () => {
    const fetchRepoTree = vi.fn().mockResolvedValue({ count: 5, rateLimit: mockRateLimit })
    vi.mocked(createGitHubClient).mockResolvedValue({ fetchRepoTree } as never)

    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/sync/o/r/tree?ref=develop",
      "user-1",
      { method: "POST" },
    )
    await handler({ request, params: { owner: "o", repo: "r" } })

    expect(fetchRepoTree).toHaveBeenCalledWith("o", "r", "develop")
  })
})
