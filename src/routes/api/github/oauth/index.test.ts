import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { revokeGitHubGrantForUser } from "@/lib/github-connection"

vi.mock("@/lib/github-connection", () => ({
  revokeGitHubGrantForUser: vi.fn().mockResolvedValue({ attempted: true, revoked: true }),
}))

describe("GET /api/github/oauth/", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id")
    vi.stubEnv("BASE_URL", "https://app.example.com")
    vi.mocked(revokeGitHubGrantForUser).mockResolvedValue({ attempted: true, revoked: true })
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

  it("returns 302 redirect to GitHub when userId provided", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/oauth/?userId=user-123")
    const res = await handler({ request })

    expect(res.status).toBe(302)
    const location = res.headers.get("Location")
    expect(location).toContain("github.com/login/oauth/authorize")
    expect(location).toContain("client_id=test-client-id")
    expect(location).toContain("state=user-123")
    expect(location).toContain("admin%3Arepo_hook")
  })

  it("does not revoke grant on GET requests", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/oauth/?userId=user-123&reconnect=1")
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(revokeGitHubGrantForUser).not.toHaveBeenCalled()
  })

  it("returns 500 when GITHUB_CLIENT_ID not configured", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "")
    vi.resetModules()

    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/oauth/?userId=user-123")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)

    expect(status).toBe(500)
    expect(body.error).toBe("GitHub OAuth not configured")
  })
})

describe("POST /api/github/oauth/", () => {
  beforeEach(() => {
    vi.mocked(revokeGitHubGrantForUser).mockResolvedValue({ attempted: true, revoked: true })
    vi.resetModules()
  })

  it("returns 401 when auth header is missing", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/oauth/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const req = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ userId: "user-123" }),
    })
    const res = await handler({ request: req })
    expect(res.status).toBe(401)
  })

  it("returns 401 when body userId does not match auth user", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/oauth/", "user-123", {
      method: "POST",
    })
    const req = new Request(request.url, {
      method: "POST",
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-999" }),
    })
    const res = await handler({ request: req })
    expect(res.status).toBe(401)
  })

  it("revokes existing grant for authenticated reconnect", async () => {
    const { Route } = await import("./index")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/oauth/", "user-123", {
      method: "POST",
    })
    const req = new Request(request.url, {
      method: "POST",
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-123" }),
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean; revoked: boolean }>(res)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.revoked).toBe(true)
    expect(revokeGitHubGrantForUser).toHaveBeenCalledWith("user-123")
  })
})
