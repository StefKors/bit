import { beforeEach, describe, expect, it, vi } from "vitest"

const pullRequestFileUpdateMock = vi.fn((payload: Record<string, unknown>) => ({
  link: vi.fn((links: Record<string, string>) => ({ payload, links })),
}))
const pullRequestFileDeleteMock = vi.fn(() => ({}))

vi.mock("@/lib/InstantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: {
      pullRequestFiles: new Proxy(
        {},
        {
          get: () => ({
            update: pullRequestFileUpdateMock,
            delete: pullRequestFileDeleteMock,
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

import { fetchFilesForCommit, syncPRFiles } from "./GithubPrFiles"
import { getInstallationToken } from "@/lib/GithubApp"
import { adminDb } from "@/lib/InstantAdmin"
import { log } from "@/lib/Logger"

const mockGetInstallationToken = vi.mocked(getInstallationToken)
const mockAdminDb = vi.mocked(adminDb)
const mockLog = vi.mocked(log)

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

  describe("syncPRFiles", () => {
    it("does nothing when no files returned", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files: [] }), { status: 200 }),
      )

      await syncPRFiles("pr-id", 123, "owner", "repo", "base", "head")
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

      await syncPRFiles("pr-id", 123, "owner", "repo", "base", "head")

      expect(mockAdminDb.query).toHaveBeenCalledTimes(1)
      expect(mockAdminDb.transact).toHaveBeenCalledTimes(2)
      const secondTransactArg = mockAdminDb.transact.mock.calls[1]?.[0] as Array<{
        payload?: Record<string, unknown>
      }>
      expect(secondTransactArg[0]?.payload?.commitSha).toBe("head")
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

      await syncPRFiles("pr-id", 123, "owner", "repo", "base", "head")

      expect(mockAdminDb.transact).toHaveBeenCalledTimes(1)
    })

    it("logs and throws when insert transaction fails", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const files = [{ filename: "b.ts", status: "added", additions: 10, deletions: 0 }]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files }), { status: 200 }),
      )

      mockAdminDb.query.mockResolvedValue({
        pullRequestFiles: [],
      } as never)
      mockAdminDb.transact.mockRejectedValue(new Error("insert failed"))

      await expect(syncPRFiles("pr-id", 123, "owner", "repo", "base", "head")).rejects.toThrow(
        "insert failed",
      )
      expect(mockLog.error).toHaveBeenCalledWith(
        "Failed to insert pull request files",
        expect.any(Error),
        expect.objectContaining({
          pullRequestId: "pr-id",
          owner: "owner",
          repo: "repo",
          baseSha: "base",
          headSha: "head",
          filesCount: 1,
        }),
      )
    })

    it("logs and throws when delete transaction fails", async () => {
      mockGetInstallationToken.mockResolvedValue("token-123")
      const files = [{ filename: "c.ts", status: "modified", additions: 1, deletions: 1 }]
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ files }), { status: 200 }),
      )

      mockAdminDb.query.mockResolvedValue({
        pullRequestFiles: [{ id: "existing-1" }],
      } as never)
      mockAdminDb.transact.mockRejectedValueOnce(new Error("delete failed"))

      await expect(syncPRFiles("pr-id", 123, "owner", "repo", "base", "head")).rejects.toThrow(
        "delete failed",
      )
      expect(mockLog.error).toHaveBeenCalledWith(
        "Failed to delete existing pull request files",
        expect.any(Error),
        expect.objectContaining({
          pullRequestId: "pr-id",
          owner: "owner",
          repo: "repo",
          baseSha: "base",
          headSha: "head",
          existingCount: 1,
        }),
      )
      expect(mockAdminDb.transact).toHaveBeenCalledTimes(1)
    })
  })
})
