import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { Route } = await import("./permissions")

describe("GET /api/github/permissions", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(createMockGitHubClient())
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/permissions")
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 400 when client creation fails", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(null)

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/permissions", "user-1")
    const res = await handler({ request })
    expect(res.status).toBe(400)
  })

  it("returns permission report on success", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/permissions", "user-1")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ allGranted: boolean }>(res)

    expect(status).toBe(200)
    expect(body).toHaveProperty("allGranted")
  })

  it("returns 500 when getTokenScopes throws", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({ getTokenScopes: vi.fn().mockRejectedValue(new Error("fail")) }),
    )

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/permissions", "user-1")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(500)
    expect(body.error).toBe("Failed to check permissions")
  })
})
