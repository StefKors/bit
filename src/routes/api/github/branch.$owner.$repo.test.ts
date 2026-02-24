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

const { Route } = await import("./branch.$owner.$repo")

import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { RequestError } from "octokit"

describe("/api/github/branch/$owner/$repo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when auth is missing for delete", async () => {
    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeRequest("http://localhost/api/github/branch/test-owner/test-repo", {
      method: "DELETE",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo" },
    })

    expect(response.status).toBe(401)
  })

  it("deletes branch successfully", async () => {
    const mockDeleteBranch = vi.fn().mockResolvedValue({ deleted: true })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ deleteBranch: mockDeleteBranch }),
    )

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/branch/test-owner/test-repo",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ branch: "feature/test" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo" },
    })

    expect(response.status).toBe(200)
    expect(mockDeleteBranch).toHaveBeenCalledWith("test-owner", "test-repo", "feature/test")
  })

  it("restores branch successfully", async () => {
    const mockRestoreBranch = vi.fn().mockResolvedValue({
      restored: true,
      ref: "refs/heads/feature/test",
      sha: "abc1234",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ restoreBranch: mockRestoreBranch }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/branch/test-owner/test-repo",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ branch: "feature/test", sha: "abc1234" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo" },
    })

    expect(response.status).toBe(200)
    expect(mockRestoreBranch).toHaveBeenCalledWith(
      "test-owner",
      "test-repo",
      "feature/test",
      "abc1234",
    )
  })

  it("returns 404 when branch delete fails with not found", async () => {
    const error = new RequestError("Not Found", 404, {
      request: { method: "DELETE", url: "", headers: {} },
      response: { status: 404, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        deleteBranch: vi.fn().mockRejectedValue(error),
      }),
    )

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/branch/test-owner/test-repo",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, { body: JSON.stringify({ branch: "missing" }) })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo" },
    })

    expect(response.status).toBe(404)
    const { body } = await parseJsonResponse<{ code: string }>(response)
    expect(body.code).toBe("not_found")
  })

  it("returns 401 on GitHub auth failure", async () => {
    const error = new RequestError("Unauthorized", 401, {
      request: { method: "DELETE", url: "", headers: {} },
      response: { status: 401, url: "", headers: {}, data: {} },
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        deleteBranch: vi.fn().mockRejectedValue(error),
      }),
    )
    vi.mocked(isGitHubAuthError).mockReturnValue(true)

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/branch/test-owner/test-repo",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ branch: "feature/test" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo" },
    })

    expect(response.status).toBe(401)
    expect(handleGitHubAuthError).toHaveBeenCalledWith("test-user-id")
  })
})
