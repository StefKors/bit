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

const { Route } = await import("./suggestions.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"

describe("/api/github/suggestions/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a suggestion comment", async () => {
    const mockCreateSuggestedChange = vi.fn().mockResolvedValue({
      id: 777,
      body: "```suggestion\nconst answer = 42\n```",
      htmlUrl: "https://github.com/test/repo/pull/1#discussion_r777",
      path: "src/index.ts",
      line: 12,
      side: "RIGHT",
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ createSuggestedChange: mockCreateSuggestedChange }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/suggestions/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        body: "Please apply this",
        suggestion: "const answer = 42",
        path: "src/index.ts",
        line: 12,
        side: "RIGHT",
        commitId: "abc123",
      }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(201)
    expect(mockCreateSuggestedChange).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      body: "Please apply this",
      suggestion: "const answer = 42",
      path: "src/index.ts",
      line: 12,
      side: "RIGHT",
      commitId: "abc123",
    })
  })

  it("returns 400 for invalid body", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/suggestions/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        suggestion: "",
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

    const request = makeRequest("http://localhost/api/github/suggestions/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
