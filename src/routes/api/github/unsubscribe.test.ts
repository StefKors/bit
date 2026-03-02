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
                delete: vi.fn().mockReturnValue({}),
              }),
            },
          ),
      },
    ),
  },
}))

const { Route } = await import("./unsubscribe")

describe("POST /api/github/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createGitHubClient).mockResolvedValue({
      listRepoWebhooks: vi.fn().mockResolvedValue([{ id: 1, isOurs: true }]),
      deleteRepoWebhook: vi.fn().mockResolvedValue(undefined),
    } as never)
  })

  it("returns 401 when missing auth", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = new Request("http://localhost/api/github/unsubscribe", {
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

    mockQuery.mockResolvedValueOnce({ repos: [] })
    const request = makeAuthRequest("http://localhost/api/github/unsubscribe", "user-1")
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

  it("unsubscribes and deletes related repo data", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    mockQuery.mockResolvedValueOnce({
      repos: [
        {
          id: "repo-1",
          fullName: "owner/repo",
          pullRequests: [],
          issues: [],
          repoTrees: [{ id: "tree-1" }],
          repoBlobs: [{ id: "blob-1" }],
          repoCommits: [{ id: "commit-1" }],
          prChecks: [{ id: "check-1" }],
        },
      ],
    })
    const request = makeAuthRequest("http://localhost/api/github/unsubscribe", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ repoFullName: "owner/repo" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean; deletedHooks: number }>(
      res,
    )
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deletedHooks).toBe(1)
    expect(mockTransact).toHaveBeenCalled()
  })
})
