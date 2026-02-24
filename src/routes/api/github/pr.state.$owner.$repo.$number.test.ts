import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn(),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: {
      pullRequests: {
        "pr-123": {
          update: vi.fn().mockReturnValue({}),
        },
      },
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./pr.state.$owner.$repo.$number")

import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { RequestError } from "octokit"

describe("PATCH /api/github/pr/state/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when authorization header is missing", async () => {
    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeRequest("http://localhost/api/github/pr/state/test-owner/test-repo/1", {
      method: "PATCH",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("auth_missing")
  })

  it("returns 400 when request body is invalid", async () => {
    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/state/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ state: "invalid" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid request body")
  })

  it("successfully closes a PR", async () => {
    const mockUpdatePullRequestState = vi.fn().mockResolvedValue({
      state: "closed",
      number: 1,
      merged: false,
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        updatePullRequestState: mockUpdatePullRequestState,
      }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({
        repos: [{ id: "repo-123", fullName: "test-owner/test-repo" }],
      })
      .mockResolvedValueOnce({
        pullRequests: [{ id: "pr-123" }],
      })
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/state/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ state: "closed" }) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdatePullRequestState).toHaveBeenCalledWith("test-owner", "test-repo", 1, "closed")
    const { body } = await parseJsonResponse<{ state: string }>(response)
    expect(body.state).toBe("closed")
  })

  it("successfully reopens a PR", async () => {
    const mockUpdatePullRequestState = vi.fn().mockResolvedValue({
      state: "open",
      number: 1,
      merged: false,
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        updatePullRequestState: mockUpdatePullRequestState,
      }),
    )
    vi.mocked(adminDb.query).mockResolvedValue({
      repos: [{ id: "repo-123", fullName: "test-owner/test-repo" }],
      pullRequests: [{ id: "pr-123" }],
    })
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/state/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ state: "open" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdatePullRequestState).toHaveBeenCalledWith("test-owner", "test-repo", 1, "open")
  })

  it("returns 404 when PR is not found", async () => {
    const error = new RequestError("Not Found", 404, {
      request: { method: "PATCH", url: "", headers: {} },
      response: { status: 404, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        updatePullRequestState: vi.fn().mockRejectedValue(error),
      }),
    )

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/state/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ state: "closed" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(404)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("not_found")
  })

  it("returns 401 for GitHub auth errors", async () => {
    const error = new RequestError("Unauthorized", 401, {
      request: { method: "PATCH", url: "", headers: {} },
      response: { status: 401, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        updatePullRequestState: vi.fn().mockRejectedValue(error),
      }),
    )
    vi.mocked(isGitHubAuthError).mockReturnValue(true)

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/state/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ state: "closed" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
    expect(handleGitHubAuthError).toHaveBeenCalledWith("test-user-id")
  })
})
