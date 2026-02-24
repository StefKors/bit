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

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./review-comments.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"

describe("/api/github/review-comments/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an inline review comment", async () => {
    const mockCreateReviewComment = vi.fn().mockResolvedValue({
      id: 123,
      body: "Looks good",
      htmlUrl: "https://github.com/test/repo/pull/1#discussion_r123",
      path: "src/index.ts",
      line: 42,
      side: "RIGHT",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ createReviewComment: mockCreateReviewComment }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/review-comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        body: "Looks good",
        path: "src/index.ts",
        line: 42,
        side: "RIGHT",
        commitId: "abc123",
      }),
    })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(201)
    expect(mockCreateReviewComment).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      body: "Looks good",
      path: "src/index.ts",
      line: 42,
      side: "RIGHT",
      commitId: "abc123",
    })
  })

  it("creates a reply to an existing review comment", async () => {
    const mockCreateReviewComment = vi.fn().mockResolvedValue({
      id: 124,
      body: "Replying",
      htmlUrl: "https://github.com/test/repo/pull/1#discussion_r124",
      path: "src/index.ts",
      line: 42,
      side: "RIGHT",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ createReviewComment: mockCreateReviewComment }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/review-comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        body: "Replying",
        inReplyTo: 999,
      }),
    })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(201)
    expect(mockCreateReviewComment).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      body: "Replying",
      inReplyTo: 999,
    })
  })

  it("returns 400 for invalid line number", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/review-comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        body: "Bad line",
        path: "src/index.ts",
        line: 0,
        side: "RIGHT",
        commitId: "abc123",
      }),
    })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid request body")
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest(
      "http://localhost/api/github/review-comments/test-owner/test-repo/1",
      {
        method: "POST",
      },
    )
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
