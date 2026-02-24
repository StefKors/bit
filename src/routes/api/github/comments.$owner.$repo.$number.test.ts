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

const { Route } = await import("./comments.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"

describe("/api/github/comments/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a comment", async () => {
    const mockCreateIssueComment = vi.fn().mockResolvedValue({
      id: 123,
      body: "Hello world",
      htmlUrl: "https://github.com/test/repo/pull/1#issuecomment-123",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ createIssueComment: mockCreateIssueComment }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ body: "Hello world" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(201)
    expect(mockCreateIssueComment).toHaveBeenCalledWith("test-owner", "test-repo", 1, "Hello world")
  })

  it("updates a comment", async () => {
    const mockUpdateIssueComment = vi.fn().mockResolvedValue({
      id: 123,
      body: "Updated",
      htmlUrl: "https://github.com/test/repo/pull/1#issuecomment-123",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ updateIssueComment: mockUpdateIssueComment }),
    )

    const handler = getRouteHandler(Route, "PATCH")
    if (!handler) throw new Error("No PATCH handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "PATCH" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ commentId: 123, body: "Updated" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUpdateIssueComment).toHaveBeenCalledWith("test-owner", "test-repo", 123, "Updated")
  })

  it("deletes a comment", async () => {
    const mockDeleteIssueComment = vi.fn().mockResolvedValue({ deleted: true })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ deleteIssueComment: mockDeleteIssueComment }),
    )

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/comments/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ commentId: 123 }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    const { body } = await parseJsonResponse<{ deleted: boolean }>(response)
    expect(body.deleted).toBe(true)
    expect(mockDeleteIssueComment).toHaveBeenCalledWith("test-owner", "test-repo", 123)
  })

  it("returns 401 when unauthenticated", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/comments/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
