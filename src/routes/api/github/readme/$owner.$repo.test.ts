import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"

const mockGetReadme = vi.hoisted(() => vi.fn())

vi.mock("octokit", () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        getReadme: mockGetReadme,
      },
    }
  },
}))

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: {},
  },
}))

const { Route } = await import("./$owner.$repo")

describe("GET /api/github/readme/:owner/:repo", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      syncStates: [{ lastEtag: "token-123" }],
    })
    mockGetReadme.mockResolvedValue({
      data: {
        content: Buffer.from("# Hello").toString("base64"),
        name: "README.md",
        path: "README.md",
      },
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/readme/o/r")
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    expect(res.status).toBe(401)
  })

  it("returns 400 when GitHub account not connected", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({ syncStates: [] })

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/readme/o/r", "user-1")
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    expect(res.status).toBe(400)
  })

  it("returns README content on success", async () => {
    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/readme/o/r", "user-1")
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    const { status, body } = await parseJsonResponse<{ content: string; name: string }>(res)

    expect(status).toBe(200)
    expect(body.content).toContain("# Hello")
    expect(body.name).toBe("README.md")
  })

  it("returns content null for 404", async () => {
    mockGetReadme.mockRejectedValueOnce({ status: 404 })

    const handler = getRouteHandler(Route, "GET")
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/readme/o/r", "user-1")
    const res = await handler({ request, params: { owner: "o", repo: "r" } })
    const { status, body } = await parseJsonResponse<{ content: null }>(res)

    expect(status).toBe(200)
    expect(body.content).toBeNull()
  })
})
