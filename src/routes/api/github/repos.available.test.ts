import { beforeEach, describe, expect, it, vi } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import { createMockGitHubClient } from "@/lib/api/route-mocks"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { Route } = await import("./repos.available")

describe("GET /api/github/repos/available", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchAvailableRepos: vi.fn().mockResolvedValue({
          data: [
            {
              githubId: 2,
              fullName: "zeta/repo",
              githubPushedAt: undefined,
              githubUpdatedAt: undefined,
            },
            {
              githubId: 1,
              fullName: "alpha/repo",
              githubPushedAt: undefined,
              githubUpdatedAt: undefined,
            },
          ],
          rateLimit: {
            remaining: 5000,
            limit: 5000,
            reset: new Date(),
            used: 0,
          },
          fromCache: false,
        }),
      }),
    )
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/repos/available")
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 400 when GitHub client is unavailable", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(null)

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/repos/available", "user-1")
    const res = await handler({ request })
    expect(res.status).toBe(400)
  })

  it("returns sorted repository names from GitHub API", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/repos/available", "user-1")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ repos: string[] }>(res)

    expect(status).toBe(200)
    expect(body.repos).toEqual(["alpha/repo", "zeta/repo"])
  })

  it("returns 500 when GitHub fetch fails", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchAvailableRepos: vi.fn().mockRejectedValue(new Error("boom")),
      }),
    )

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/repos/available", "user-1")
    const res = await handler({ request })
    expect(res.status).toBe(500)
  })
})
