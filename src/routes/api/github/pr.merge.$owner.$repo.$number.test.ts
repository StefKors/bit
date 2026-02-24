import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"

// Mock dependencies
vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn(),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./pr.merge.$owner.$repo.$number")

import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { RequestError } from "octokit"

describe("POST /api/github/pr/merge/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when authorization header is missing", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/pr/merge/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
    const { body } = await parseJsonResponse<{ error: string; code: string }>(response)
    expect(body.error).toBe("Unauthorized")
    expect(body.code).toBe("auth_missing")
  })

  it("returns 400 when PR number is invalid", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/invalid",
      "test-user-id",
      { method: "POST" },
    )
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "invalid" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid pull request number")
  })

  it("returns 400 when request body is invalid JSON", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = new Request("http://localhost/api/github/pr/merge/test-owner/test-repo/1", {
      method: "POST",
      headers: { Authorization: "Bearer test-user-id" },
      body: "not valid json",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid JSON body")
  })

  it("returns 401 when GitHub client cannot be created", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(null)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
    const { body } = await parseJsonResponse<{ error: string; code: string }>(response)
    expect(body.code).toBe("auth_invalid")
  })

  it("successfully merges a PR with default options", async () => {
    const mockMergePullRequest = vi.fn().mockResolvedValue({
      merged: true,
      message: "Pull request successfully merged",
      sha: "abc123",
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: mockMergePullRequest,
      }),
    )
    vi.mocked(adminDb.query).mockResolvedValue({
      repos: [{ id: "repo-123", fullName: "test-owner/test-repo" }],
    })
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = {}
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    const { body } = await parseJsonResponse<{ merged: boolean; sha: string }>(response)
    expect(body.merged).toBe(true)
    expect(body.sha).toBe("abc123")

    expect(mockMergePullRequest).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      mergeMethod: "merge",
    })
  })

  it("successfully merges a PR with custom options", async () => {
    const mockMergePullRequest = vi.fn().mockResolvedValue({
      merged: true,
      message: "Pull request successfully merged",
      sha: "def456",
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: mockMergePullRequest,
      }),
    )
    vi.mocked(adminDb.query).mockResolvedValue({
      repos: [{ id: "repo-123", fullName: "test-owner/test-repo" }],
    })
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = {
      mergeMethod: "squash",
      commitTitle: "Custom commit title",
      commitMessage: "Custom commit message",
      sha: "head-sha-123",
    }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockMergePullRequest).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      mergeMethod: "squash",
      commitTitle: "Custom commit title",
      commitMessage: "Custom commit message",
      sha: "head-sha-123",
    })
  })

  it("returns 409 on merge conflict", async () => {
    const error = new RequestError("Merge conflict", 405, {
      request: { method: "PUT", url: "", headers: {} },
      response: { status: 405, url: "", headers: {}, data: {} },
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: vi.fn().mockRejectedValue(error),
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(409)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("merge_conflict")
  })

  it("returns 404 when PR is not found", async () => {
    const error = new RequestError("Not Found", 404, {
      request: { method: "PUT", url: "", headers: {} },
      response: { status: 404, url: "", headers: {}, data: {} },
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: vi.fn().mockRejectedValue(error),
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(404)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("not_found")
  })

  it("returns 422 for unprocessable requests", async () => {
    const error = new RequestError("Required status check failed", 422, {
      request: { method: "PUT", url: "", headers: {} },
      response: {
        status: 422,
        url: "",
        headers: {},
        data: { message: "Required status check failed" },
      },
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: vi.fn().mockRejectedValue(error),
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(422)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("unprocessable")
  })

  it("returns 401 for GitHub auth errors", async () => {
    const error = new RequestError("Unauthorized", 401, {
      request: { method: "PUT", url: "", headers: {} },
      response: { status: 401, url: "", headers: {}, data: {} },
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: vi.fn().mockRejectedValue(error),
      }),
    )
    vi.mocked(isGitHubAuthError).mockReturnValue(true)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("auth_invalid")
    expect(handleGitHubAuthError).toHaveBeenCalledWith("test-user-id")
  })

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(isGitHubAuthError).mockReturnValue(false)

    const mockClient = createMockGitHubClient({})
    mockClient.mergePullRequest = vi.fn().mockRejectedValue(new Error("Network error"))

    vi.mocked(createGitHubClient).mockResolvedValue(mockClient)

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(500)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("internal_error")
  })

  it("successfully merges and returns 200", async () => {
    const mockMergePullRequest = vi.fn().mockResolvedValue({
      merged: true,
      message: "Merged",
      sha: "abc123",
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: mockMergePullRequest,
      }),
    )
    vi.mocked(adminDb.query).mockResolvedValue({
      repos: [{ id: "repo-123", fullName: "test-owner/test-repo" }],
    })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockMergePullRequest).toHaveBeenCalled()
  })

  it("handles missing repo record gracefully after merge", async () => {
    const mockMergePullRequest = vi.fn().mockResolvedValue({
      merged: true,
      message: "Merged",
      sha: "abc123",
    })

    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        mergePullRequest: mockMergePullRequest,
      }),
    )
    vi.mocked(adminDb.query).mockResolvedValue({
      repos: [],
    })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "merge" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    // Should still return success even if we can't update local state
    expect(response.status).toBe(200)
  })

  it("validates mergeMethod enum", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/pr/merge/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const bodyContent = { mergeMethod: "invalid_method" }
    const requestWithBody = new Request(request, { body: JSON.stringify(bodyContent) })

    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
    const { body } = await parseJsonResponse<{ error: string }>(response)
    expect(body.error).toBe("Invalid request body")
  })
})
