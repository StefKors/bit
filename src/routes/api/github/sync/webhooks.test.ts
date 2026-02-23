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

const { Route } = await import("./webhooks")

describe("POST /api/github/sync/webhooks", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        registerAllWebhooks: vi.fn().mockResolvedValue({
          total: 3,
          installed: 2,
          noAccess: 1,
          errors: [],
          results: [],
        }),
      }),
    )
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/webhooks", { method: "POST" })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns webhook registration result on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/webhooks", "user-1", {
      method: "POST",
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{
      success: boolean
      total: number
      installed: number
    }>(res)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.total).toBe(3)
    expect(body.installed).toBe(2)
  })
})
