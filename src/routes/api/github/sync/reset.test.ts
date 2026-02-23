import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"

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
                update: vi.fn().mockReturnThis(),
                delete: vi.fn().mockReturnThis(),
              }),
            },
          ),
      },
    ),
  },
}))

const { Route } = await import("./reset")

describe("POST /api/github/sync/reset", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      syncStates: [{ id: "state-1", resourceType: "repos", userId: "user-1" }],
    })
  })

  it("returns 400 when resourceType is missing", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/reset", "user-1")
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

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/sync/reset", { method: "POST" })
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "repos" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    expect(res.status).toBe(401)
  })

  it("returns 404 when sync state not found", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({ syncStates: [] })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/reset", "user-1")
    const req = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ resourceType: "repos" }),
      headers: { ...Object.fromEntries(request.headers), "Content-Type": "application/json" },
    })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ error: string }>(res)
    expect(status).toBe(404)
    expect(body.error).toBe("Sync state not found")
  })

  it("returns success when reset completes", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/reset", "user-1")
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
})

describe("DELETE /api/github/sync/reset", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      syncStates: [{ id: "state-1" }, { id: "state-2" }],
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = new Request("http://localhost/api/github/sync/reset", { method: "DELETE" })
    const res = await handler({ request })
    expect(res.status).toBe(401)
  })

  it("returns deleted count on success", async () => {
    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeAuthRequest("http://localhost/api/github/sync/reset", "user-1")
    const req = new Request(request.url, { method: "DELETE", headers: request.headers })
    const res = await handler({ request: req })
    const { status, body } = await parseJsonResponse<{ success: boolean; deleted: number }>(res)

    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deleted).toBe(2)
  })
})
