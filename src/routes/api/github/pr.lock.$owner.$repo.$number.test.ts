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

const { Route } = await import("./pr.lock.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/pr/lock/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
  })

  it("locks a pull request conversation", async () => {
    const mockLockIssue = vi.fn().mockResolvedValue({ locked: true, lockReason: "resolved" })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ lockIssue: mockLockIssue }),
    )

    const handler = getRouteHandler(Route, "PUT")
    if (!handler) throw new Error("No PUT handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/lock/test-owner/test-repo/1",
      "test-user-id",
      { method: "PUT" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ lockReason: "resolved" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockLockIssue).toHaveBeenCalledWith("test-owner", "test-repo", 1, {
      lockReason: "resolved",
    })
    const { body } = await parseJsonResponse<{ locked: boolean }>(response)
    expect(body.locked).toBe(true)
  })

  it("unlocks a pull request conversation", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
    const mockUnlockIssue = vi.fn().mockResolvedValue({ locked: false, lockReason: null })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ unlockIssue: mockUnlockIssue }),
    )

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/lock/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockUnlockIssue).toHaveBeenCalledWith("test-owner", "test-repo", 1)
    const { body } = await parseJsonResponse<{ locked: boolean }>(response)
    expect(body.locked).toBe(false)
  })

  it("returns 400 for invalid lock reason", async () => {
    const handler = getRouteHandler(Route, "PUT")
    if (!handler) throw new Error("No PUT handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/lock/test-owner/test-repo/1",
      "test-user-id",
      { method: "PUT" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ lockReason: "invalid" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(400)
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "PUT")
    if (!handler) throw new Error("No PUT handler")
    const request = makeRequest("http://localhost/api/github/pr/lock/test-owner/test-repo/1", {
      method: "PUT",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
