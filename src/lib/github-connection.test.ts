import { describe, it, expect, vi, beforeEach } from "vitest"
import { adminDb } from "@/lib/instantAdmin"

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const { isReconnectRequest, getLatestAccessToken, revokeGitHubGrantForUser } =
  await import("./github-connection")

describe("github-connection", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_CLIENT_ID", "client-id")
    vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret")
    vi.mocked(adminDb.query).mockResolvedValue({ syncStates: [] })
    mockFetch.mockReset()
  })

  describe("isReconnectRequest", () => {
    it("returns true for supported truthy values", () => {
      expect(isReconnectRequest("1")).toBe(true)
      expect(isReconnectRequest("true")).toBe(true)
      expect(isReconnectRequest("YES")).toBe(true)
      expect(isReconnectRequest("on")).toBe(true)
    })

    it("returns false for empty or falsy values", () => {
      expect(isReconnectRequest(null)).toBe(false)
      expect(isReconnectRequest("")).toBe(false)
      expect(isReconnectRequest("0")).toBe(false)
      expect(isReconnectRequest("false")).toBe(false)
    })
  })

  describe("getLatestAccessToken", () => {
    it("returns null when there are no token states", () => {
      expect(getLatestAccessToken([])).toBeNull()
    })

    it("returns the most recently updated token", () => {
      const token = getLatestAccessToken([
        { id: "state-1", lastEtag: "old-token", updatedAt: 100 },
        { id: "state-2", lastEtag: "new-token", updatedAt: 200 },
      ])
      expect(token).toBe("new-token")
    })
  })

  describe("revokeGitHubGrantForUser", () => {
    it("returns no_token when user has no saved token", async () => {
      vi.mocked(adminDb.query).mockResolvedValue({ syncStates: [] })

      const result = await revokeGitHubGrantForUser("user-1")
      expect(result).toEqual({ attempted: false, revoked: false, reason: "no_token" })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns oauth_not_configured when OAuth app credentials are missing", async () => {
      vi.stubEnv("GITHUB_CLIENT_ID", "")
      vi.stubEnv("GITHUB_CLIENT_SECRET", "")
      vi.mocked(adminDb.query).mockResolvedValue({
        syncStates: [{ id: "state-1", lastEtag: "token-1", updatedAt: 100 }],
      })

      const result = await revokeGitHubGrantForUser("user-1")
      expect(result).toEqual({
        attempted: false,
        revoked: false,
        reason: "oauth_not_configured",
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("revokes the latest saved token", async () => {
      vi.mocked(adminDb.query).mockResolvedValue({
        syncStates: [
          { id: "state-1", lastEtag: "older-token", updatedAt: 100 },
          { id: "state-2", lastEtag: "latest-token", updatedAt: 200 },
        ],
      })
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      })

      const result = await revokeGitHubGrantForUser("user-1")
      expect(result).toEqual({ attempted: true, revoked: true })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/applications/client-id/grant",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ access_token: "latest-token" }),
        }),
      )
    })

    it("treats 404 as already revoked", async () => {
      vi.mocked(adminDb.query).mockResolvedValue({
        syncStates: [{ id: "state-1", lastEtag: "token-1", updatedAt: 100 }],
      })
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const result = await revokeGitHubGrantForUser("user-1")
      expect(result).toEqual({ attempted: true, revoked: true })
    })
  })
})
