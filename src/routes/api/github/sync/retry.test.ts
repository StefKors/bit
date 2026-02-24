import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGitHubClient } from "@/lib/github-client"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"
import { createMockGitHubClient, mockRateLimit } from "@/lib/api/route-mocks"

vi.mock("@/lib/github-client", () => ({
  createGitHubClient: vi.fn(),
  isGitHubAuthError: vi.fn().mockReturnValue(false),
  handleGitHubAuthError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/instantAdmin", () => {
  const chainable = () => ({ update: vi.fn().mockReturnThis() })
  return {
    adminDb: {
      query: vi.fn().mockResolvedValue({ webhookDeliveries: [] }),
      transact: vi.fn().mockResolvedValue(undefined),
      tx: {
        webhookDeliveries: new Proxy({}, { get: () => chainable() }),
      },
    },
  }
})

vi.mock("@/lib/webhooks", () => ({
  handlePushWebhook: vi.fn().mockResolvedValue(undefined),
  handleCreateWebhook: vi.fn().mockResolvedValue(undefined),
  handleDeleteWebhook: vi.fn().mockResolvedValue(undefined),
  handleForkWebhook: vi.fn().mockResolvedValue(undefined),
  handleRepositoryWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestEventWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestReviewWebhook: vi.fn().mockResolvedValue(undefined),
  handleCommentWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueCommentWebhook: vi.fn().mockResolvedValue(undefined),
  handleStarWebhook: vi.fn().mockResolvedValue(undefined),
  handleOrganizationWebhook: vi.fn().mockResolvedValue(undefined),
}))

const { Route } = await import("./retry")

describe("POST /api/github/sync/retry", () => {
  beforeEach(() => {
    vi.mocked(createGitHubClient).mockResolvedValue(createMockGitHubClient())
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/retry", { method: "POST" })
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "repos" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    expect(res.status).toBe(401)
  })

  it("returns 400 when resourceType is missing", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("resourceType is required")
  })

  it("returns success for overview resource type", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchOrganizations: vi.fn().mockResolvedValue({ data: [], rateLimit: mockRateLimit }),
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "overview" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean }>(res)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns success for repos resource type", async () => {
    vi.mocked(createGitHubClient).mockResolvedValue(
      createMockGitHubClient({
        fetchRepositories: vi.fn().mockResolvedValue({ data: [], rateLimit: mockRateLimit }),
      }),
    )

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "repos" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean }>(res)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 400 for pulls without resourceId", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "pulls" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("resourceId required for pull requests")
  })

  it("returns retried count for webhooks resource type", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      webhookDeliveries: [{ id: "d1", event: "push", payload: JSON.stringify({}) }],
    })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "webhooks" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ retried: number; succeeded: number }>(res)

    expect(status).toBe(200)
    expect(body.retried).toBe(1)
    expect(body.succeeded).toBe(1)
  })

  it("keeps malformed webhook delivery payloads in failed state", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      webhookDeliveries: [{ id: "d1", event: "push", payload: "{invalid-json" }],
    })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "webhooks" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{
      retried: number
      succeeded: number
      stillFailed: number
    }>(res)

    expect(status).toBe(200)
    expect(body.retried).toBe(1)
    expect(body.succeeded).toBe(0)
    expect(body.stillFailed).toBe(1)
  })

  it("returns 400 for unsupported resource type", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/retry", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "unknown" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Unsupported resource type")
  })
})
