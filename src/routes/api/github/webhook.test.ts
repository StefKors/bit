import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHmac } from "crypto"
import { getRouteHandler, parseJsonResponse } from "@/lib/test-helpers"

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => "mock-id"),
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn().mockResolvedValue({ webhookDeliveries: [], webhookQueue: [] }),
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

vi.mock("@/lib/webhooks/processor", () => ({
  enqueueWebhook: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { enqueueWebhook } from "@/lib/webhooks/processor"

const signPayload = (payload: string, secret: string) => {
  const hmac = createHmac("sha256", secret)
  return "sha256=" + hmac.update(payload).digest("hex")
}

describe("POST /api/github/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "test-secret")
    vi.resetModules()
    vi.mocked(enqueueWebhook).mockReset()
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

  it("enqueues valid webhook and returns queued response", async () => {
    vi.mocked(enqueueWebhook).mockResolvedValue({
      queued: true,
      duplicate: false,
      queueItemId: "queue-123",
    })

    const { Route } = await import("./webhook")
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const payload = JSON.stringify({ action: "opened", pull_request: {} })
    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-hub-signature-256": signPayload(payload, "test-secret"),
        "x-github-event": "pull_request",
        "x-github-delivery": "delivery-1",
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{
      received: boolean
      queued: boolean
      queueItemId: string
    }>(res)
    expect(status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.queued).toBe(true)
    expect(body.queueItemId).toBe("queue-123")
  })

  it("returns duplicate response for already-delivered webhooks", async () => {
    vi.mocked(enqueueWebhook).mockResolvedValue({
      queued: false,
      duplicate: true,
    })

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
    const { status, body } = await parseJsonResponse<{ received: boolean; duplicate: boolean }>(res)
    expect(status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.duplicate).toBe(true)
  })

  it("returns 400 when delivery ID is missing", async () => {
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
      },
    })
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(400)
    expect(body.error).toBe("Missing delivery ID")
  })
})
