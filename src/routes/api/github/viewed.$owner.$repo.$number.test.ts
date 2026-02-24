import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getRouteHandler,
  makeAuthRequest,
  makeRequest,
  parseJsonResponse,
} from "@/lib/test-helpers"

vi.mock("@/lib/instantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => ({
                update: vi.fn().mockReturnValue({}),
              }),
            },
          ),
      },
    ),
  },
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { Route } = await import("./viewed.$owner.$repo.$number")

import { adminDb } from "@/lib/instantAdmin"

describe("/api/github/viewed/$owner/$repo/$number", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminDb.transact).mockResolvedValue(undefined)
  })

  it("marks a file as viewed", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [{ id: "pr-1", viewedFiles: "[]" }] })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/viewed/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ path: "src/index.ts" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    const { body } = await parseJsonResponse<{ viewed: boolean; viewedFiles: string[] }>(response)
    expect(body.viewed).toBe(true)
    expect(body.viewedFiles).toEqual(["src/index.ts"])
  })

  it("marks a file as unviewed", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({
        pullRequests: [{ id: "pr-1", viewedFiles: JSON.stringify(["src/index.ts"]) }],
      })

    const handler = getRouteHandler(Route, "DELETE")
    if (!handler) throw new Error("No DELETE handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/viewed/test-owner/test-repo/1",
      "test-user-id",
      { method: "DELETE" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ path: "src/index.ts" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(200)
    const { body } = await parseJsonResponse<{ viewed: boolean; viewedFiles: string[] }>(response)
    expect(body.viewed).toBe(false)
    expect(body.viewedFiles).toEqual([])
  })

  it("returns 404 when PR record is missing", async () => {
    vi.mocked(adminDb.query)
      .mockResolvedValueOnce({ repos: [{ id: "repo-1" }] })
      .mockResolvedValueOnce({ pullRequests: [] })

    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeAuthRequest(
      "http://localhost/api/github/viewed/test-owner/test-repo/1",
      "test-user-id",
      { method: "POST" },
    )
    const requestWithBody = new Request(request, {
      body: JSON.stringify({ path: "src/index.ts" }),
    })
    const response = await handler({
      request: requestWithBody,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(404)
  })

  it("returns 401 without auth header", async () => {
    const handler = getRouteHandler(Route, "POST")
    if (!handler) throw new Error("No POST handler")

    const request = makeRequest("http://localhost/api/github/viewed/test-owner/test-repo/1", {
      method: "POST",
    })
    const response = await handler({
      request,
      params: { owner: "test-owner", repo: "test-repo", number: "1" },
    })

    expect(response.status).toBe(401)
  })
})
