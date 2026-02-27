import { describe, it, expect, vi, beforeEach } from "vitest"
import { getRouteHandler, makeRequest, parseJsonResponse } from "@/lib/test-helpers"

describe("GET /api/github/oauth/", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_APP_SLUG", "bit-backend")
    vi.resetModules()
  })

  it("returns 400 when userId is missing", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/oauth/")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)

    expect(status).toBe(400)
    expect(body.error).toBe("userId is required")
  })

  it("returns 302 redirect to GitHub App installation when userId provided", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/oauth/?userId=user-123")
    const res = await handler({ request })

    expect(res.status).toBe(302)
    const location = res.headers.get("Location")
    expect(location).toContain("github.com/apps/bit-backend/installations/new")
    expect(location).toContain("state=user-123")
  })
})
