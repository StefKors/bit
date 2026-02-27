import { describe, it, expect, vi, beforeEach } from "vitest"
import { getRouteHandler, makeAuthRequest, parseJsonResponse } from "@/lib/test-helpers"

vi.mock("@/lib/cerebras", () => ({
  isCerebrasConfigured: vi.fn(),
  chatCompletion: vi.fn(),
  DEFAULT_MODEL: "gpt-oss-120b",
  isValidCerebrasModelId: vi.fn((m: string) =>
    ["gpt-oss-120b", "llama3.1-8b", "qwen-3-235b-a22b-instruct-2507", "zai-glm-4.7"].includes(m),
  ),
}))

const { Route } = await import("./chat")
const cerebras = await import("@/lib/cerebras")

describe("POST /api/cerebras/chat", () => {
  beforeEach(() => {
    vi.mocked(cerebras.isCerebrasConfigured).mockReturnValue(true)
    vi.mocked(cerebras.chatCompletion).mockResolvedValue("Hello")
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = new Request("http://localhost/api/cerebras/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns 400 when messages invalid", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/cerebras/chat", "user-1", {
      method: "POST",
    })
    const req = new Request(request.url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ role: "invalid", content: "hi" }] }),
    })
    const res = await handler({ request: req })
    expect(res.status).toBe(400)
  })

  it("returns 200 with content on success", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/cerebras/chat", "user-1", {
      method: "POST",
    })
    const req = new Request(request.url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ content?: string }>(res)
    expect(status).toBe(200)
    expect(body.content).toBe("Hello")
  })
})
