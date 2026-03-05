import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/InstantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: {
      pullRequestFiles: new Proxy(
        {},
        {
          get: (_target, _prop) => ({
            update: vi.fn().mockReturnValue({
              link: vi.fn().mockReturnValue({}),
            }),
            delete: vi.fn().mockReturnValue({}),
          }),
        },
      ),
    },
  },
}))

vi.mock("@/lib/GithubApp", () => ({
  getInstallationToken: vi.fn(),
}))

vi.mock("@/lib/Logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import {
  fetchFilesForCommit,
  fetchPRFiles,
  fetchPRCommits,
  syncPRFilesForCommit,
} from "./GithubPrFiles"
import { getInstallationToken } from "@/lib/GithubApp"
import { adminDb } from "@/lib/InstantAdmin"

const mockGetInstallationToken = vi.mocked(getInstallationToken)
const mockAdminDb = vi.mocked(adminDb)

describe("GithubPrFiles", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  describe("fetchFilesForCommit", () => {
    it("returns empty array when no installation token", async () => {
      mockGetInstallationToken.mockResolvedValue(null)
      const result = await fetchFilesForCommit(123, "owner", "repo", "base", "head")
      expect(result).toEqual([])
    })

    it("returns files from compare API", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const files = [
        {
          filename: "src/a.ts",
          status: "modified",
          additions: 5,
          deletions: 2,
          patch: "@@ -1 +1 @@",
        },
        { filename: "src/b.ts", status: "added", additions: 10, deletions: 0 },
      ]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files }), { status: 200 }),
      )

      const result = await fetchFilesForCommit(123, "owner", "repo", "abc123", "def456")
      expect(result).toEqual(files)

      const fetchMock = vi.mocked(globalThis.fetch)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] ?? []
      expect(url).toBe("https://api.github.com/repos/owner/repo/compare/abc123...def456")
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe("token token-123")
    })

    it("returns empty array on API error", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response("Not Found", { status: 404 }))

      const result = await fetchFilesForCommit(123, "owner", "repo", "abc", "def")
      expect(result).toEqual([])
    })

    it("returns empty array when response has no files", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      )

      const result = await fetchFilesForCommit(123, "owner", "repo", "abc", "def")
      expect(result).toEqual([])
    })

    it("paginates through Link header when more than 300 files", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const page1 = [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0 }]
      const page2 = [{ filename: "b.ts", status: "added", additions: 10, deletions: 0 }]

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ files: page1 }), {
            status: 200,
            headers: {
              Link: '<https://api.github.com/repos/o/r/compare/base...head?page=2>; rel="next"',
            },
          }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ files: page2 }), { status: 200 }))

      const result = await fetchFilesForCommit(123, "owner", "repo", "base", "head")
      expect(result).toEqual([...page1, ...page2])
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe("fetchPRFiles", () => {
    it("returns null when no installation token", async () => {
      mockGetInstallationToken.mockResolvedValue(null)
      const result = await fetchPRFiles(123, "owner", "repo", 1)
      expect(result).toBeNull()
    })

    it("returns null when PR fetch fails", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response("Not Found", { status: 404 }))

      const result = await fetchPRFiles(123, "owner", "repo", 1)
      expect(result).toBeNull()
    })

    it("fetches PR then compare files", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const prData = { base: { sha: "base-sha" }, head: { sha: "head-sha" } }
      const files = [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0 }]

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(prData), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ files }), { status: 200 }))

      const result = await fetchPRFiles(123, "owner", "repo", 42)
      expect(result).toEqual({ files, baseSha: "base-sha", headSha: "head-sha" })
    })
  })

  describe("fetchPRCommits", () => {
    it("returns empty array when no installation token", async () => {
      mockGetInstallationToken.mockResolvedValue(null)
      const result = await fetchPRCommits(123, "owner", "repo", 1)
      expect(result).toEqual([])
    })

    it("returns commits list", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const commits = [
        { sha: "abc", commit: { message: "first" } },
        { sha: "def", commit: { message: "second" } },
      ]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify(commits), { status: 200 }),
      )

      const result = await fetchPRCommits(123, "owner", "repo", 42)
      expect(result).toEqual(commits)
    })
  })

  describe("syncPRFilesForCommit", () => {
    it("does nothing when no files returned", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files: [] }), { status: 200 }),
      )

      await syncPRFilesForCommit("pr-id", 123, "owner", "repo", "base", "head")
      expect(mockAdminDb.query).not.toHaveBeenCalled()
    })

    it("deletes existing files and inserts new ones", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const files = [
        { filename: "a.ts", status: "modified", additions: 3, deletions: 1, patch: "@@" },
      ]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files }), { status: 200 }),
      )

      mockAdminDb.query.mockResolvedValue({
        pullRequestFiles: [{ id: "existing-1" }],
      } as never)
      mockAdminDb.transact.mockResolvedValue({} as never)

      await syncPRFilesForCommit("pr-id", 123, "owner", "repo", "base", "head")

      expect(mockAdminDb.query).toHaveBeenCalledTimes(1)
      expect(mockAdminDb.transact).toHaveBeenCalledTimes(2)
    })

    it("skips delete when no existing files", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const files = [{ filename: "b.ts", status: "added", additions: 10, deletions: 0 }]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files }), { status: 200 }),
      )

      mockAdminDb.query.mockResolvedValue({
        pullRequestFiles: [],
      } as never)
      mockAdminDb.transact.mockResolvedValue({} as never)

      await syncPRFilesForCommit("pr-id", 123, "owner", "repo", "base", "head")

      expect(mockAdminDb.transact).toHaveBeenCalledTimes(1)
    })
  })
})
