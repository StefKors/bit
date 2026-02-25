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

const { Route } = await import("./pr.labels.$owner.$repo.$number")

import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/pr/labels/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
  })

  it("adds labels to a pull request", async () => {
    const mockAddLabels = vi.fn().mockResolvedValue({
      labels: [{ name: "bug", color: "d73a4a" }],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ addLabels: mockAddLabels }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/labels/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ labels: ["bug"] }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockAddLabels).toHaveBeenCalledWith("test-owner", "test-repo", 1, ["bug"])
  })

  it("removes a label from a pull request", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
    const mockRemoveLabel = vi.fn().mockResolvedValue({
      labels: [],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ removeLabel: mockRemoveLabel }),
    )

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/labels/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ label: "bug" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockRemoveLabel).toHaveBeenCalledWith("test-owner", "test-repo", 1, "bug")
  })

  it("replaces all labels on a pull request", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1" }] })
    const mockSetLabels = vi.fn().mockResolvedValue({
      labels: [{ name: "enhancement", color: "a2eeef" }],
    })
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ setLabels: mockSetLabels }),
    )

    const handler = getRouteHandler(Route, "PUT")
    if (!handler) throw new Error("No PUT handler")
    const request = makeAuthRequest(
      "http://localhost/api/github/pr/labels/test-owner/test-repo/1",
      "test-user-id",
      { method: "PUT" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ labels: ["enhancement"] }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    expect(mockSetLabels).toHaveBeenCalledWith("test-owner", "test-repo", 1, ["enhancement"])
    const { body } = await parseJsonResponse<{ labels: Array<{ name: string }> }>(response)
    expect(body.labels[0]?.name).toBe("enhancement")
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")
    const request = makeRequest("http://localhost/api/github/pr/labels/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
