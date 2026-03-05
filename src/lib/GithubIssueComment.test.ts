import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/GithubApp", () => ({
  getInstallationIdForRepo: vi.fn(),
  getInstallationToken: vi.fn(),
}))

vi.mock("@/lib/Logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { createIssueComment } from "./GithubIssueComment"
import { getInstallationIdForRepo, getInstallationToken } from "@/lib/GithubApp"

const mockGetInstallationIdForRepo = vi.mocked(getInstallationIdForRepo)
const mockGetInstallationToken = vi.mocked(getInstallationToken)

describe("createIssueComment", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  it("returns null when no installation for user", async () => {
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

  it("returns null when no installation token", async () => {
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

  it("returns null on GitHub API error", async () => {
    mockGetInstallationIdForRepo.mockResolvedValue(123)
    mockGetInstallationToken.mockResolvedValue("token-123")
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

  it("returns htmlUrl on success", async () => {
    mockGetInstallationIdForRepo.mockResolvedValue(123)
    mockGetInstallationToken.mockResolvedValue("token-123")
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/owner/repo/issues/42#issuecomment-1" }),
        {
          status: 201,
        },
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/42/comments")
    expect(init?.method).toBe("POST")
    expect(JSON.parse((init?.body as string) ?? "{}")).toEqual({ body: "Hello world" })
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer token-123")
  })

  it("returns empty htmlUrl when response has no html_url", async () => {
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
