import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHmac } from "crypto"
import { getRouteHandler, parseJsonResponse } from "@/lib/test-helpers"

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => "mock-id"),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn().mockResolvedValue({ webhookDeliveries: [] }),
    transact: vi.fn().mockResolvedValue(undefined),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnThis(),
              }),
            },
          ),
      },
    ),
  },
}))

vi.mock("@/lib/webhooks", () => ({
  handlePullRequestWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestReviewWebhook: vi.fn().mockResolvedValue(undefined),
  handleCommentWebhook: vi.fn().mockResolvedValue(undefined),
  handlePushWebhook: vi.fn().mockResolvedValue(undefined),
  handleRepositoryWebhook: vi.fn().mockResolvedValue(undefined),
  handleStarWebhook: vi.fn().mockResolvedValue(undefined),
  handleForkWebhook: vi.fn().mockResolvedValue(undefined),
  handleOrganizationWebhook: vi.fn().mockResolvedValue(undefined),
  handleCreateWebhook: vi.fn().mockResolvedValue(undefined),
  handleDeleteWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestEventWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueCommentWebhook: vi.fn().mockResolvedValue(undefined),
}))

const signPayload = (payload: string, secret: string) => {
  const hmac = createHmac("sha256", secret)
  return "sha256=" + hmac.update(payload).digest("hex")
}

describe("POST /api/github/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "test-secret")
    vi.resetModules()
  })

  it("returns 500 when GITHUB_WEBHOOK_SECRET not configured", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "")
    vi.resetModules()

    const { Route } = await import("./webhook")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const payload = JSON.stringify({ action: "opened" })
    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-hub-signature-256": signPayload(payload, "test-secret"),
        "x-github-event": "ping",
        "x-github-delivery": "delivery-1",
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(500)
    expect(body.error).toBe("Webhook not configured")
  })

  it("returns 401 when signature is invalid", async () => {
    const { Route } = await import("./webhook")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const payload = JSON.stringify({ zen: "pong" })
    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-hub-signature-256": "sha256=invalid",
        "x-github-event": "ping",
        "x-github-delivery": "delivery-1",
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(401)
    expect(body.error).toBe("Invalid signature")
  })

  it("returns 400 for invalid JSON payload", async () => {
    const { Route } = await import("./webhook")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const payload = "not valid json"
    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-hub-signature-256": signPayload(payload, "test-secret"),
        "x-github-event": "ping",
        "x-github-delivery": "delivery-1",
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Invalid JSON payload")
  })

  it("returns received true for valid ping event", async () => {
    const { Route } = await import("./webhook")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const payload = JSON.stringify({ zen: "pong" })
    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-hub-signature-256": signPayload(payload, "test-secret"),
        "x-github-event": "ping",
        "x-github-delivery": "delivery-1",
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ received: boolean }>(res)
    expect(status).toBe(200)
    expect(body.received).toBe(true)
  })
})
