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

vi.mock("@/lib/github-app", () => ({
  storeInstallationId: vi.fn().mockResolvedValue(undefined),
  getInstallationAccount: vi.fn().mockResolvedValue({
    login: "testuser",
    githubId: 1,
    avatarUrl: "https://avatar",
    htmlUrl: "https://github.com/testuser",
  }),
  getInstallationToken: vi.fn().mockResolvedValue("gh-token"),
}))

vi.mock("@/lib/github-client", () => ({
  GitHubClient: class MockGitHubClient {
    performInitialSync = mockPerformInitialSync
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe("GET /api/github/oauth/callback", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_APP_ID", "123")
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "key")
    vi.resetModules()
    mockPerformInitialSync.mockReset().mockResolvedValue({ synced: true })
  })

  it("redirects with error when installation error param present", async () => {
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

  it("redirects as connected when installation_id and state present", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request(
      "http://localhost/api/github/oauth/callback?installation_id=123&state=user-123&setup_action=install",
    )
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("github=connected")
  })

  it("redirects with error when installation or state missing", async () => {
    const { Route } = await import("./callback")
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = new Request("http://localhost/api/github/oauth/callback")
    const res = await handler({ request })

    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toContain("Missing+installation+or+state")
  })
})
