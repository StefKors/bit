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

const { Route } = await import("./pr.reviewers.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/pr/reviewers/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
  })

  it("adds requested reviewers", async () => {
    const mockRequestReviewers = vi.fn().mockResolvedValue({
      requestedReviewers: ["reviewer-a", "reviewer-b"],
      requestedTeams: [],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ requestReviewers: mockRequestReviewers }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/reviewers/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        reviewers: ["reviewer-a", "reviewer-b"],
      }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockRequestReviewers).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      reviewers: ["reviewer-a", "reviewer-b"],
      teamReviewers: undefined,
    })
    const { body } = await parseJsonResponse<{ requestedReviewers: string[] }>(response)
    expect(body.requestedReviewers).toEqual(["reviewer-a", "reviewer-b"])
  })

  it("removes requested reviewers", async () => {
    const mockRemoveRequestedReviewers = vi.fn().mockResolvedValue({
      requestedReviewers: [],
      requestedTeams: [],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ removeRequestedReviewers: mockRemoveRequestedReviewers }),
    )
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/reviewers/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({
        reviewers: ["reviewer-a"],
      }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockRemoveRequestedReviewers).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      reviewers: ["reviewer-a"],
      teamReviewers: undefined,
    })
  })

  it("returns 400 when no reviewers are provided", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/reviewers/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ reviewers: [] }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
  })

  it("returns 401 without auth", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeRequest("http://localhost/api/github/pr/reviewers/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
