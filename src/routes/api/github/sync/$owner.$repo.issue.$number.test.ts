import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"

const linkResult = vi.hoisted(() => {
  const r = { link: vi.fn() }
  r.link.mockReturnValue(r)
  return r
})

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn().mockResolvedValue(undefined),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnValue(linkResult),
              }),
            },
          ),
      },
    ),
  },
}))

const mockGetIssue = vi.hoisted(() => vi.fn())
const mockListIssueComments = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn().mockImplementation((userId: string) => {
    if (userId === "no-client") return Promise.resolve(null)
    return Promise.resolve({
      getIssue: mockGetIssue,
      listIssueComments: mockListIssueComments,
    })
  }),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => "mock-id"),
}))

const { Route } = await import("./$owner.$repo.issue.$number")

describe("POST /api/github/sync/:owner/:repo/issue/:number", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    const { createGitHubClient } = await import("@/lib/github-client")
    vi.mocked(createGitHubClient).mockResolvedValue({
      getIssue: mockGetIssue,
      listIssueComments: mockListIssueComments,
    } as never)
    vi.mocked(adminDb.query).mockImplementation((q: Record<string, unknown>) => {
      if (q.repos) return Promise.resolve({ repos: [{ id: "repo-1", fullName: "o/r" }] })
      if (q.issues) return Promise.resolve({ issues: [] })
      if (q.issueComments) return Promise.resolve({ issueComments: [] })
      return Promise.resolve({})
    })
    mockGetIssue.mockResolvedValue({
      id: 1,
      number: 42,
      title: "Test issue",
      body: "Body",
      state: "open",
      state_reason: null,
      user: { login: "user", avatar_url: "https://avatar" },
      html_url: "https://github.com/o/r/issues/42",
      labels: [],
      comments: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      closed_at: null,
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/o/r/issue/1", { method: "POST" })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid issue number", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/abc", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "abc" },
    })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Invalid issue number")
  })

  it("returns 400 when GitHub account not connected", async () => {
    const { createGitHubClient } = await import("@/lib/github-client")
    vi.mocked(createGitHubClient).mockResolvedValueOnce(null)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/1", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when repo not in database", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockImplementation((q: Record<string, unknown>) => {
      if (q.repos) return Promise.resolve({ repos: [] })
      return Promise.resolve({})
    })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/1", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(404)
    expect(body.error).toBe("Repository not found in database")
  })

  it("returns issueId on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/42", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "42" },
    })
    const { status, body } = await parseJsonResponse<{ issueId: string }>(res)

    expect(status).toBe(200)
    expect(body.issueId).toBeTruthy()
  })
})
