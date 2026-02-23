import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeAuthRequest, makeRequest, parseJsonResponse } from "@/lib/test-helpers"

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

vi.mock("@/lib/github-client", () => ({
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

const mockIssuesGet = vi.hoisted(() => vi.fn())
const mockPaginate = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock("octokit", () => ({
  Octokit: class MockOctokit {
    rest = {
      issues: {
        get: mockIssuesGet,
        listComments: vi.fn(),
      },
    }
    paginate = mockPaginate
  },
}))

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => "mock-id"),
}))

const { Route } = await import("./$owner.$repo.issue.$number")

describe("POST /api/github/sync/:owner/:repo/issue/:number", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockImplementation(async (q: Record<string, unknown>) => {
      if (q.syncStates) return { syncStates: [{ lastEtag: "token" }] }
      if (q.repos) return { repos: [{ id: "repo-1", fullName: "o/r" }] }
      if (q.issues) return { issues: [] }
      if (q.issueComments) return { issueComments: [] }
      return {}
    })
    mockIssuesGet.mockResolvedValue({
      data: {
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
      },
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/o/r/issue/1", { method: "POST" })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid issue number", async () => {
    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/abc", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "abc" },
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("Invalid issue number")
  })

  it("returns 400 when GitHub account not connected", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValueOnce({ syncStates: [] })

    const handler = Route.options.server?.handlers?.POST
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
    vi.mocked(adminDb.query).mockImplementation(async (q: Record<string, unknown>) => {
      if (q.syncStates) return { syncStates: [{ lastEtag: "token" }] }
      if (q.repos) return { repos: [] }
      return {}
    })

    const handler = Route.options.server?.handlers?.POST
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/o/r/issue/1", "user-1", {
      method: "POST",
    })
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", number: "1" },
    })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe("Repository not found in database")
  })

  it("returns issueId on success", async () => {
    const handler = Route.options.server?.handlers?.POST
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
