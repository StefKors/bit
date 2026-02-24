import { beforeEach, describe, expect, it, vi } from "vitest"
import { getRouteHandler, makeAuthRequest, makeRequest } from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./reviews.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"

describe("/api/github/reviews/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("submits approve review", async () => {
    const mockCreatePullRequestReview = vi.fn().mockResolvedValue({
      id: 1,
      state: "APPROVED",
      body: "Looks good",
      htmlUrl: "https://github.com/test/repo/pull/1#pullrequestreview-1",
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        createPullRequestReview: mockCreatePullRequestReview,
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/reviews/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ event: "APPROVE", body: "Looks good" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(201)
    expect(mockCreatePullRequestReview).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      event: "APPROVE",
      body: "Looks good",
    })
  })

  it("submits request changes review", async () => {
    const mockCreatePullRequestReview = vi.fn().mockResolvedValue({
      id: 2,
      state: "CHANGES_REQUESTED",
      body: "Please update tests",
      htmlUrl: null,
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        createPullRequestReview: mockCreatePullRequestReview,
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/reviews/test-owner/test-repo/2",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ event: "REQUEST_CHANGES", body: "Please update tests" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "2" },
    })

    expect(response.status).toBe(201)
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeRequest("http://localhost/api/github/reviews/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
