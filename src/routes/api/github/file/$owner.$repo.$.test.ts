import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeAuthRequest, makeRequest, parseJsonResponse } from "@/lib/test-helpers"

const mockGetContent = vi.hoisted(() => vi.fn())

vi.mock("octokit", () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        getContent: mockGetContent,
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

const { Route } = await import("./$owner.$repo.$")

describe("GET /api/github/file/:owner/:repo/*", () => {
  beforeEach(async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({
      syncStates: [{ lastEtag: "token-123" }],
    })
    mockGetContent.mockResolvedValue({
      data: {
        type: "file",
        content: Buffer.from("file content").toString("base64"),
        sha: "abc123",
        size: 12,
        name: "foo.ts",
        path: "src/foo.ts",
      },
    })
  })

  it("returns 401 when no auth header", async () => {
    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeRequest("http://localhost/api/github/file/o/r/path")
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", _splat: "path" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when GitHub account not connected", async () => {
    const { adminDb } = await import("@/lib/instantAdmin")
    vi.mocked(adminDb.query).mockResolvedValue({ syncStates: [] })

    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/file/o/r/path", "user-1")
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", _splat: "path" },
    })
    expect(res.status).toBe(400)
  })

  it("returns file content on success", async () => {
    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/file/o/r/src/foo.ts", "user-1")
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", _splat: "src/foo.ts" },
    })
    const { status, body } = await parseJsonResponse<{ content: string; name: string }>(res)

    expect(status).toBe(200)
    expect(body.content).toContain("file content")
    expect(body.name).toBe("foo.ts")
  })

  it("returns 400 when path is a directory", async () => {
    mockGetContent.mockResolvedValueOnce({ data: [] })

    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = makeAuthRequest("http://localhost/api/github/file/o/r/dir", "user-1")
    const res = await handler({
      request,
      params: { owner: "o", repo: "r", _splat: "dir" },
    })
    expect(res.status).toBe(400)
  })
})
