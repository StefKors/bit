import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import { getRouteHandler, makeAuthRequest, parseJsonResponse } from "@/lib/test-helpers"
import { createMockGitHubClient, mockRateLimit } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

const { Route } = await import("./add-repo")

describe("POST /api/github/sync/add-repo", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchPullRequests: vi.fn().mockResolvedValue({
          data: [{ id: "pr-1" }, { id: "pr-2" }],
          rateLimit: mockRateLimit,
        }),
        registerRepoWebhook: vi.fn().mockResolvedValue({ status: "installed" }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = new Request("http://localhost/api/github/sync/add-repo", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/owner/repo" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 400 when url is missing", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/add-repo", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Invalid request body")
  })

  it("returns 400 for invalid GitHub URL", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/add-repo", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ url: "not-a-valid-url" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Invalid GitHub URL")
  })

  it("accepts owner/repo format", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/add-repo", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ url: "owner/repo" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ owner: string; repo: string }>(res)

    expect(status).toBe(200)
    expect(body.owner).toBe("owner")
    expect(body.repo).toBe("repo")
  })

  it("returns pull request count and webhook status on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/add-repo", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/owner/repo" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{
      pullRequests: number
      webhookStatus: string
    }>(res)

    expect(status).toBe(200)
    expect(body.pullRequests).toBe(2)
    expect(body.webhookStatus).toBe("installed")
  })
})
