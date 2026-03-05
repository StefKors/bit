import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleWebhookPost } from "./webhook"

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/webhook-persistence", () => ({
  persistWebhookPayloadSafely: vi.fn(async () => {}),
}))

const signPayload = (payload: string, secret: string): string => {
  const digest = createHmac("sha256", secret).update(payload).digest("hex")
  return `sha256=${digest}`
}

describe("webhook route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns 500 when webhook secret is missing", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET

    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: "{}",
      headers: {
        "x-github-event": "ping",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": "sha256=invalid",
      },
    })

    const response = await handleWebhookPost({ request })
    expect(response.status).toBe(500)
  })

  it("returns 401 for invalid signature", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "secret"

    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: JSON.stringify({ action: "opened" }),
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": "delivery-2",
        "x-hub-signature-256": "sha256=invalid",
      },
    })

    const response = await handleWebhookPost({ request })
    expect(response.status).toBe(401)
  })

  it("returns 400 when event header is missing", async () => {
    const secret = "secret"
    process.env.GITHUB_WEBHOOK_SECRET = secret
    const payload = JSON.stringify({ action: "opened" })
    const signature = signPayload(payload, secret)

    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-github-delivery": "delivery-3",
        "x-hub-signature-256": signature,
      },
    })

    const response = await handleWebhookPost({ request })
    expect(response.status).toBe(400)
  })

  it("persists valid webhook payloads", async () => {
    const secret = "secret"
    process.env.GITHUB_WEBHOOK_SECRET = secret
    const payload = JSON.stringify({
      action: "opened",
      repository: { id: 1, full_name: "acme/repo", name: "repo", owner: { login: "acme" } },
      sender: { id: 1, login: "octocat" },
    })
    const signature = signPayload(payload, secret)

    const request = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": "delivery-4",
        "x-hub-signature-256": signature,
      },
    })

    const persistWebhook = vi.fn(async () => {})
    const response = await handleWebhookPost({ request, persistWebhook })
    expect(response.status).toBe(200)
    const expectedPayload = JSON.parse(payload) as object
    expect(persistWebhook).toHaveBeenCalledWith({
      event: "pull_request",
      payload: expectedPayload,
    })
  })
})
