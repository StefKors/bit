import { describe, it, expect, vi, beforeEach } from "vitest"
import { log, formatError, formatContext } from "./logger"

beforeEach(() => vi.restoreAllMocks())

describe("formatContext", () => {
  it("formats key-value pairs", () => {
    expect(formatContext({ op: "sync", repo: "bit" })).toBe("op=sync repo=bit")
  })

  it("JSON-stringifies non-string values", () => {
    expect(formatContext({ count: 42 })).toBe("count=42")
  })

  it("skips null and undefined values", () => {
    expect(formatContext({ a: "yes", b: null, c: undefined })).toBe("a=yes")
  })

  it("returns empty string for empty context", () => {
    expect(formatContext({})).toBe("")
  })
})

describe("formatError", () => {
  it("extracts message from Error", () => {
    const result = formatError(new Error("boom"))
    expect(result.message).toBe("boom")
    expect(typeof result.stack).toBe("string")
  })

  it("extracts status from error-like objects", () => {
    const err = { message: "Not Found", status: 404 }
    expect(formatError(err)).toEqual({ message: "Not Found", status: 404 })
  })

  it("handles plain strings", () => {
    expect(formatError("oops")).toEqual({ message: "oops" })
  })

  it("handles objects with type field", () => {
    expect(formatError({ type: "operation-timed-out" })).toEqual({
      message: "operation-timed-out",
      status: undefined,
    })
  })

  it("handles null", () => {
    expect(formatError(null)).toEqual({ message: "null" })
  })
})

describe("log", () => {
  it("log.info outputs formatted message", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    log.info("Sync started", { repo: "bit", branch: "main" })
    expect(spy).toHaveBeenCalledWith("[info] Sync started | repo=bit branch=main")
  })

  it("log.info works without context", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    log.info("Health check")
    expect(spy).toHaveBeenCalledWith("[info] Health check")
  })

  it("log.warn outputs formatted message", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    log.warn("Rate limit low", { remaining: 10 })
    expect(spy).toHaveBeenCalledWith("[warn] Rate limit low | remaining=10")
  })

  it("log.error includes error details in context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    log.error("Sync failed", new Error("timeout"), { repo: "bit" })
    expect(spy).toHaveBeenCalledWith("[error] Sync failed | repo=bit error=timeout")
  })

  it("log.error includes status from HTTP errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    log.error("API error", { status: 404, message: "Not Found" }, { endpoint: "/api/test" })
    expect(spy).toHaveBeenCalledWith(
      "[error] API error | endpoint=/api/test error=Not Found status=404",
    )
  })
})
