import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import { makeAuthRequest, makeRequest, parseJsonResponse } from "@/lib/test-helpers"
import { mockRateLimit } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Import after mocks
const { Route } = await import("./rate-limit")

describe("GET /api/github/rate-limit", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue({
      getRateLimit: vi.fn().mockResolvedValue(mockRateLimit),
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/rate-limit")
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 400 when client creation fails", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(null)

    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const res = await handler({ request })
    expect(res.status).toBe(400)
  })

  it("returns rate limit on success", async () => {
    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ rateLimit: typeof mockRateLimit }>(res)

    expect(status).toBe(200)
    expect(body.rateLimit.remaining).toBe(mockRateLimit.remaining)
    expect(body.rateLimit.limit).toBe(mockRateLimit.limit)
  })

  it("returns 500 when getRateLimit throws", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue({
      getRateLimit: vi.fn().mockRejectedValue(new Error("fail")),
    })

    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/rate-limit", "user-1")
    const res = await handler({ request })
    expect(res.status).toBe(500)
  })
})
