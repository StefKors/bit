import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"
import { RequestError } from "octokit"

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
                update: vi.fn().mockReturnValue({}),
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

const { Route } = await import("./pr.update.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("PATCH /api/github/pr/update/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
  })

  it("updates pull request title and body", async () => {
    const mockUpdatePullRequest = vi.fn().mockResolvedValue({
      number: 12,
      title: "Updated PR title",
      body: "Updated description",
      state: "open",
      draft: false,
      githubUpdatedAt: 1_700_000_000_000,
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updatePullRequest: mockUpdatePullRequest }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1", title: "Old", body: "Old" }] })

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/update/test-owner/test-repo/12",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        title: "Updated PR title",
        body: "Updated description",
      }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "12" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdatePullRequest).toHaveBeenCalledWith("test-owner", "test-repo", 12, {
      title: "Updated PR title",
      body: "Updated description",
    })
    const { body } = await parseJsonResponse<{ title: string; body: string }>(response)
    expect(body.title).toBe("Updated PR title")
    expect(body.body).toBe("Updated description")
  })

  it("returns 400 when neither title nor body provided", async () => {
    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/update/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({}),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid request body")
  })

  it("returns 404 when pull request does not exist", async () => {
    const error = new RequestError("Not Found", 404, {
      request: { method: "PATCH", url: "", headers: {} },
      response: { status: 404, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updatePullRequest: vi.fn().mockRejectedValue(error) }),
    )

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/update/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ title: "Updated" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(404)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("not_found")
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeRequest("http://localhost/api/github/pr/update/test-owner/test-repo/1", {
      method: "PATCH",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
