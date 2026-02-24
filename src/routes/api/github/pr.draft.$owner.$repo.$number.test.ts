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

const { Route } = await import("./pr.draft.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/pr/draft/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
  })

  it("converts a pull request to draft", async () => {
    const mockConvertToDraft = vi.fn().mockResolvedValue({
      number: 1,
      state: "open",
      draft: true,
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ convertPullRequestToDraft: mockConvertToDraft }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/draft/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ action: "convert_to_draft" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockConvertToDraft).toHaveBeenCalledWith("test-owner", "test-repo", 1)
    const { body } = await parseJsonResponse<{ draft: boolean }>(response)
    expect(body.draft).toBe(true)
  })

  it("marks a pull request as ready for review", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
    const mockReadyForReview = vi.fn().mockResolvedValue({
      number: 1,
      state: "open",
      draft: false,
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ markPullRequestReadyForReview: mockReadyForReview }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/draft/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ action: "ready_for_review" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockReadyForReview).toHaveBeenCalledWith("test-owner", "test-repo", 1)
    const { body } = await parseJsonResponse<{ draft: boolean }>(response)
    expect(body.draft).toBe(false)
  })

  it("returns 400 for invalid request body", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/draft/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ action: "invalid" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeRequest("http://localhost/api/github/pr/draft/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
