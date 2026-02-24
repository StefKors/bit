import { describe, it, expect, vi, beforeEach } from "vitest"
import { getRouteHandler } from "@/lib/test-helpers"

const mockPerformInitialSync = vi.fn().mockResolvedValue({ synced: true })

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn().mockResolvedValue(undefined),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnValue({ link: vi.fn() }),
              }),
            },
          ),
      },
    ),
  },
}))

vi.mock("@/lib/sync-state", () => ({
  findOrCreateSyncStateId: vi.fn().mockResolvedValue("sync-state-id"),
}))

vi.mock("@/lib/github-client", () => ({
  GitHubClient: class MockGitHubClient {
    performInitialSync = mockPerformInitialSync
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const mockGitHubUserResponse = {
  login: "testuser",
  id: 1,
  node_id: "node-1",
  avatar_url: "https://avatar",
  gravatar_id: "",
  url: "https://api.github.com/user",
  html_url: "https://github.com/testuser",
  type: "User",
  site_admin: false,
}

const mockOAuthExchange = (scope: string) => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "gh-token",
          token_type: "bearer",
          scope,
        }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGitHubUserResponse),
      headers: new Headers({ "x-oauth-scopes": scope }),
    })
}

describe("GET /api/github/oauth/callback", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_CLIENT_ID", "client-id")
    vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret")
    vi.resetModules()
    mockFetch.mockReset()
    mockPerformInitialSync.mockReset().mockResolvedValue({ synced: true })
    mockOAuthExchange("repo,read:org,read:user,user:email")
  })

  it("redirects with error when OAuth error param present", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request(
      "http://localhost/api/github/oauth/callback?error=access_denied&error_description=User+denied",
    )
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("error=")
  })

  it("redirects when installation_id present but no code", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request(
      "http://localhost/api/github/oauth/callback?installation_id=123&setup_action=install",
    )
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("github=installed")
  })

  it("redirects with error when code or state missing", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request("http://localhost/api/github/oauth/callback")
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("Missing+code+or+state")
  })

  it("redirects to app with github=connected on success", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request(
      "http://localhost/api/github/oauth/callback?code=abc123&state=user-123",
    )
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("github=connected")
    expect(mockPerformInitialSync).toHaveBeenCalledTimes(1)
  })

  it("redirects with error and skips initial sync when required scopes are missing", async () => {
    mockFetch.mockReset()
    mockOAuthExchange("read:user,user:email")

    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request(
      "http://localhost/api/github/oauth/callback?code=abc123&state=user-123",
    )
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("error=Missing")
    expect(res.headers.get("Location")).toContain("permissions")
    expect(mockPerformInitialSync).not.toHaveBeenCalled()
  })
})
