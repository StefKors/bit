import { describe, it, expect } from "vitest"
import { Route } from "./health"
import { parseJsonResponse } from "@/lib/test-helpers"

describe("GET /api/health", () => {
  it("returns ok status with timestamp", async () => {
    const handler = Route.options.server?.handlers?.GET
    if (!handler) throw new Error("No GET handler")

    const request = new Request("http://localhost/api/health")
    const res = await handler({ request })
    const { status, body } = await parseJsonResponse<{ status: string; timestamp: string }>(res)

    expect(status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.timestamp).toBeTruthy()
  })
})
