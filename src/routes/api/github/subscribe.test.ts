import { beforeEach, describe, expect, it, vi } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import { getRouteHandler, makeAuthRequest, parseJsonResponse } from "@/lib/test-helpers"

const mockQuery = vi.fn()
const mockTransact = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: mockQuery,
    transact: mockTransact,
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnValue({}),
              }),
            },
          ),
      },
    ),
  },
}))

const { Route } = await import("./subscribe")

describe("POST /api/github/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createGitHubClient).mockResolvedValue({
      fetchPullRequests: vi.fn().mockResolvedValue({ data: [{ id: "pr-1" }, { id: "pr-2" }] }),
      registerRepoWebhook: vi.fn().mockResolvedValue({ status: "installed" }),
    } as never)
  })

  it("returns 401 when missing auth", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = new Request("http://localhost/api/github/subscribe", {
      method: "POST",
      body: JSON.stringify({ repoFullName: "owner/repo" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 404 when repository is not found", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    vi.mocked(createGitHubClient).mockResolvedValue({
      fetchPullRequests: vi.fn().mockRejectedValue({ status: 404 }),
      registerRepoWebhook: vi.fn().mockResolvedValue({ status: "installed" }),
    } as never)

    const request = makeAuthRequest("http://localhost/api/github/subscribe", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ repoFullName: "owner/repo" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(404)
    expect(body.error).toBe("Repository not found")
  })

  it("subscribes and triggers initial repo sync", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    mockQuery.mockResolvedValueOnce({ repos: [{ id: "repo-1", fullName: "owner/repo" }] })
    const request = makeAuthRequest("http://localhost/api/github/subscribe", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ repoFullName: "owner/repo" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean; pullRequests: number }>(
      res,
    )
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.pullRequests).toBe(2)
    expect(mockTransact).toHaveBeenCalled()
  })
})
