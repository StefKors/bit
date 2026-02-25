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

const { Route } = await import("./resolve.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/resolve/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
  })

  it("resolves a thread", async () => {
    const mockUpdateReviewComment = vi.fn().mockResolvedValue({ id: 321, resolved: true })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updateReviewComment: mockUpdateReviewComment }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
      .mockResolvedValueOnce({ prComments: [{ id: "comment-local" }] })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/resolve/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ commentId: 321 }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdateReviewComment).toHaveBeenCalledWith("test-owner", "test-repo", 321, {
      resolved: true,
    })
    const { body } = await parseJsonResponse<{ commentId: number; resolved: boolean }>(response)
    expect(body.commentId).toBe(321)
    expect(body.resolved).toBe(true)
  })

  it("unresolves a thread", async () => {
    const mockUpdateReviewComment = vi.fn().mockResolvedValue({ id: 654, resolved: false })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updateReviewComment: mockUpdateReviewComment }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
      .mockResolvedValueOnce({ prComments: [{ id: "comment-local" }] })

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/resolve/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ commentId: 654 }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdateReviewComment).toHaveBeenCalledWith("test-owner", "test-repo", 654, {
      resolved: false,
    })
    const { body } = await parseJsonResponse<{ commentId: number; resolved: boolean }>(response)
    expect(body.commentId).toBe(654)
    expect(body.resolved).toBe(false)
  })

  it("returns 404 when comment is not found", async () => {
    const error = new RequestError("Not Found", 404, {
      request: { method: "GET", url: "", headers: {} },
      response: { status: 404, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updateReviewComment: vi.fn().mockRejectedValue(error) }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/resolve/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ commentId: 123 }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(404)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("not_found")
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/resolve/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
