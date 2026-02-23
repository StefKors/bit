import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeAuthRequest, makeRequest, parseJsonResponse } from "./test-helpers"
import {
  extractUserId,
  jsonResponse,
  mapGitHubError,
  handleHealth,
  handleRateLimit,
  handleSync,
  type RateLimitDeps,
  type SyncDeps,
} from "./api-handlers"

beforeEach(() => vi.clearAllMocks())

// ── jsonResponse ──

describe("jsonResponse", () => {
  it("returns JSON with default 200 status", async () => {
    const res = jsonResponse({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/json")
    expect(await res.json()).toEqual({ ok: true })
  })

  it("returns JSON with custom status", async () => {
    const res = jsonResponse({ error: "nope" }, 404)
    expect(res.status).toBe(404)
  })
})

// ── extractUserId ──

describe("extractUserId", () => {
  it("extracts userId from Bearer token", () => {
    const req = makeAuthRequest("http://localhost/api/test", "user-123")
    expect(extractUserId(req)).toBe("user-123")
  })

  it("returns empty string when no auth header", () => {
    const req = makeRequest("http://localhost/api/test")
    expect(extractUserId(req)).toBe("")
  })

  it("returns 'Bearer' prefix remnant when token is missing", () => {
    const req = makeRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer" },
    })
    expect(extractUserId(req)).toBe("Bearer")
  })
})

// ── mapGitHubError ──

describe("mapGitHubError", () => {
  it("maps 404 status to not found response", async () => {
    const res = mapGitHubError({ status: 404 }, "Repository or branch", "owner/repo")
    const { status, body } = await parseJsonResponse(res)
    expect(status).toBe(404)
    expect(body).toHaveProperty("error")
  })

  it("maps 403 status to access denied", async () => {
    const res = mapGitHubError({ status: 403 }, "sync tree")
    const { status, body } = await parseJsonResponse(res)
    expect(status).toBe(403)
    expect(body).toHaveProperty("error", "Access denied")
  })

  it("maps unknown errors to 500", async () => {
    const res = mapGitHubError(new Error("boom"), "sync tree")
    const { status, body } = await parseJsonResponse<{ details: string }>(res)
    expect(status).toBe(500)
    expect(body.details).toBe("boom")
  })

  it("handles non-Error objects", async () => {
    const res = mapGitHubError("string error", "sync")
    const { status, body } = await parseJsonResponse<{ details: string }>(res)
    expect(status).toBe(500)
    expect(body.details).toBe("Unknown error")
  })
})

// ── handleHealth ──

describe("handleHealth", () => {
  it("returns ok status with timestamp", async () => {
    const res = handleHealth()
    const { status, body } = await parseJsonResponse<{ status: string; timestamp: string }>(res)
    expect(status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.timestamp).toBeTruthy()
  })
})

// ── handleRateLimit ──

describe("handleRateLimit", () => {
  const mockRateLimit = {
    remaining: 4999,
    limit: 5000,
    reset: new Date("2025-01-01"),
    used: 1,
  }

  const makeDeps = (overrides: Partial<RateLimitDeps> = {}): RateLimitDeps => ({
    createClient: vi.fn().mockResolvedValue({
      getRateLimit: vi.fn().mockResolvedValue(mockRateLimit),
    }),
    ...overrides,
  })

  it("returns 401 when no auth header", async () => {
    const req = makeRequest("http://localhost/api/github/rate-limit")
    const res = await handleRateLimit(req, makeDeps())
    expect(res.status).toBe(401)
  })

  it("returns 400 when client creation fails", async () => {
    const req = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const deps = makeDeps({ createClient: vi.fn().mockResolvedValue(null) })
    const res = await handleRateLimit(req, deps)
    expect(res.status).toBe(400)
  })

  it("returns rate limit on success", async () => {
    const req = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const res = await handleRateLimit(req, makeDeps())
    const { status, body } = await parseJsonResponse<{ rateLimit: typeof mockRateLimit }>(res)
    expect(status).toBe(200)
    expect(body.rateLimit.remaining).toBe(mockRateLimit.remaining)
    expect(body.rateLimit.limit).toBe(mockRateLimit.limit)
    expect(body.rateLimit.used).toBe(mockRateLimit.used)
  })

  it("returns 500 when getRateLimit throws", async () => {
    const req = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({
        getRateLimit: vi.fn().mockRejectedValue(new Error("fail")),
      }),
    })
    const res = await handleRateLimit(req, deps)
    expect(res.status).toBe(500)
  })
})

// ── handleSync ──

describe("handleSync", () => {
  const mockResult = {
    count: 42,
    rateLimit: { remaining: 4990, limit: 5000, reset: new Date(), used: 10 },
  }

  const makeDeps = (overrides: Partial<SyncDeps> = {}): SyncDeps => ({
    createClient: vi.fn().mockResolvedValue({
      fetchRepoTree: vi.fn().mockResolvedValue(mockResult),
      fetchRepoCommits: vi.fn().mockResolvedValue(mockResult),
    }),
    isAuthError: vi.fn().mockReturnValue(false),
    handleAuthError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  it("returns 401 when no auth header", async () => {
    const req = makeRequest("http://localhost/api/github/sync/owner/repo/tree", { method: "POST" })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", makeDeps())
    expect(res.status).toBe(401)
  })

  it("returns 400 when client creation fails", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const deps = makeDeps({ createClient: vi.fn().mockResolvedValue(null) })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    expect(res.status).toBe(400)
  })

  it("returns count and rateLimit on success", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", makeDeps())
    const { status, body } = await parseJsonResponse<{ count: number }>(res)
    expect(status).toBe(200)
    expect(body.count).toBe(42)
  })

  it("passes ref query param to sync method", async () => {
    const fetchRepoTree = vi.fn().mockResolvedValue(mockResult)
    const req = makeAuthRequest(
      "http://localhost/api/github/sync/o/r/tree?ref=develop",
      "user-1",
      { method: "POST" },
    )
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({ fetchRepoTree }),
    })
    await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    expect(fetchRepoTree).toHaveBeenCalledWith("o", "r", "develop")
  })

  it("returns auth expired when isAuthError returns true", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const handleAuthError = vi.fn().mockResolvedValue(undefined)
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({
        fetchRepoTree: vi.fn().mockRejectedValue(new Error("auth")),
      }),
      isAuthError: vi.fn().mockReturnValue(true),
      handleAuthError,
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    const { status, body } = await parseJsonResponse<{ code: string }>(res)
    expect(status).toBe(401)
    expect(body.code).toBe("auth_invalid")
    expect(handleAuthError).toHaveBeenCalledWith("user-1")
  })

  it("maps 404 errors correctly", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({
        fetchRepoTree: vi.fn().mockRejectedValue({ status: 404 }),
      }),
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    expect(res.status).toBe(404)
  })

  it("maps 403 errors correctly", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({
        fetchRepoTree: vi.fn().mockRejectedValue({ status: 403 }),
      }),
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    expect(res.status).toBe(403)
  })

  it("maps unknown errors to 500", async () => {
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/tree", "user-1", {
      method: "POST",
    })
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({
        fetchRepoTree: vi.fn().mockRejectedValue(new Error("kaboom")),
      }),
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoTree", deps)
    const { status, body } = await parseJsonResponse<{ details: string }>(res)
    expect(status).toBe(500)
    expect(body.details).toBe("kaboom")
  })

  it("works with fetchRepoCommits method", async () => {
    const fetchRepoCommits = vi.fn().mockResolvedValue(mockResult)
    const req = makeAuthRequest("http://localhost/api/github/sync/o/r/commits", "user-1", {
      method: "POST",
    })
    const deps = makeDeps({
      createClient: vi.fn().mockResolvedValue({ fetchRepoCommits }),
    })
    const res = await handleSync(req, { owner: "o", repo: "r" }, "fetchRepoCommits", deps)
    expect(res.status).toBe(200)
    expect(fetchRepoCommits).toHaveBeenCalledWith("o", "r", undefined)
  })
})
