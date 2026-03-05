import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/GithubApp", () => ({
  getInstallationIdForRepo: vi.fn(),
  getInstallationToken: vi.fn(),
  getUserGitHubToken: vi.fn(),
}))

vi.mock("@/lib/Logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { createIssueComment } from "./GithubIssueComment"
import { getInstallationIdForRepo, getInstallationToken, getUserGitHubToken } from "@/lib/GithubApp"

const mockGetInstallationIdForRepo = vi.mocked(getInstallationIdForRepo)
const mockGetInstallationToken = vi.mocked(getInstallationToken)
const mockGetUserGitHubToken = vi.mocked(getUserGitHubToken)

describe("createIssueComment", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  it("returns null when no user token and no installation", async () => {
    mockGetUserGitHubToken.mockResolvedValue(null)
    mockGetInstallationIdForRepo.mockResolvedValue(null)

    const result = await createIssueComment({
      userId: "user-1",
      owner: "owner",
      repo: "repo",
      issueNumber: 42,
      body: "Hello",
    })

    expect(result).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("returns null when no user token and no installation token", async () => {
    mockGetUserGitHubToken.mockResolvedValue(null)
    mockGetInstallationIdForRepo.mockResolvedValue(123)
    mockGetInstallationToken.mockResolvedValue(null)

    const result = await createIssueComment({
      userId: "user-1",
      owner: "owner",
      repo: "repo",
      issueNumber: 42,
      body: "Hello",
    })

    expect(result).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("uses user token when available", async () => {
    mockGetUserGitHubToken.mockResolvedValue("user-gh-token")
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/owner/repo/issues/42#issuecomment-1" }),
        { status: 201 },
      ),
    )

    const result = await createIssueComment({
      userId: "user-1",
      owner: "owner",
      repo: "repo",
      issueNumber: 42,
      body: "Hello",
    })

    expect(result).toEqual({
      htmlUrl: "https://github.com/owner/repo/issues/42#issuecomment-1",
    })

    const fetchMock = vi.mocked(globalThis.fetch)
    const [, init] = fetchMock.mock.calls[0] ?? []
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer user-gh-token")
    expect(mockGetInstallationIdForRepo).not.toHaveBeenCalled()
  })

  it("falls back to installation token when no user token", async () => {
    mockGetUserGitHubToken.mockResolvedValue(null)
    mockGetInstallationIdForRepo.mockResolvedValue(123)
    mockGetInstallationToken.mockResolvedValue("install-token")
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/owner/repo/issues/42#issuecomment-1" }),
        { status: 201 },
      ),
    )

    const result = await createIssueComment({
      userId: "user-1",
      owner: "owner",
      repo: "repo",
      issueNumber: 42,
      body: "Hello world",
    })

    expect(result).toEqual({
      htmlUrl: "https://github.com/owner/repo/issues/42#issuecomment-1",
    })

    const fetchMock = vi.mocked(globalThis.fetch)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/comments")
    expect(init?.method).toBe("POST")
    expect(JSON.parse((init?.body as string) ?? "{}")).toEqual({ body: "Hello world" })
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer install-token")
  })

  it("returns null on GitHub API error", async () => {
    mockGetUserGitHubToken.mockResolvedValue("user-gh-token")
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("Forbidden", { status: 403 }))

    const result = await createIssueComment({
      userId: "user-1",
      owner: "owner",
      repo: "repo",
      issueNumber: 42,
      body: "Hello",
    })

    expect(result).toBeNull()
  })

  it("returns empty htmlUrl when response has no html_url", async () => {
    mockGetUserGitHubToken.mockResolvedValue(null)
    mockGetInstallationIdForRepo.mockResolvedValue(123)
    mockGetInstallationToken.mockResolvedValue("token-123")
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }))

    const result = await createIssueComment({
      userId: "user-1",
      owner: "a",
      repo: "b",
      issueNumber: 1,
      body: "x",
    })

    expect(result).toEqual({ htmlUrl: "" })
  })
})
