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
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

const { Route } = await import("./overview")

describe("POST /api/github/sync/overview", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        performInitialSync: vi.fn().mockResolvedValue({ synced: true }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/overview", { method: "POST" })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns started status on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/overview", "user-1", {
      method: "POST",
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ status: string }>(res)

    expect(status).toBe(200)
    expect(body.status).toBe("started")
  })
})
