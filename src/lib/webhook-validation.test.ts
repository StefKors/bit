import { describe, it, expect } from "vitest"
import { z } from "zod/v4"
import {
  validateWebhookHeaders,
  validateWebhookPayload,
  GitHubRateLimitError,
  isRateLimitError,
  parseRateLimitHeaders,
  lenientDecode,
} from "./webhook-validation"

describe("validateWebhookHeaders", () => {
  it("validates correct headers", () => {
    const headers = new Headers({
      "x-github-event": "push",
      "x-github-delivery": "abc-123",
      "x-hub-signature-256": "sha256=deadbeef",
    })
    const result = validateWebhookHeaders(headers)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.event).toBe("push")
      expect(result.data.delivery).toBe("abc-123")
    }
  })

  it("rejects missing event header", () => {
    const headers = new Headers({
      "x-github-delivery": "abc-123",
      "x-hub-signature-256": "sha256=deadbeef",
    })
    const result = validateWebhookHeaders(headers)
    expect(result.valid).toBe(false)
  })

  it("rejects missing delivery header", () => {
    const headers = new Headers({
      "x-github-event": "push",
      "x-hub-signature-256": "sha256=deadbeef",
    })
    const result = validateWebhookHeaders(headers)
    expect(result.valid).toBe(false)
  })

  it("rejects missing signature header", () => {
    const headers = new Headers({
      "x-github-event": "push",
      "x-github-delivery": "abc-123",
    })
    const result = validateWebhookHeaders(headers)
    expect(result.valid).toBe(false)
  })
})

describe("validateWebhookPayload", () => {
  it("validates a valid payload", () => {
    const result = validateWebhookPayload({
      action: "opened",
      sender: { id: 123, login: "user" },
      repository: {
        id: 456,
        full_name: "owner/repo",
        name: "repo",
        owner: { login: "owner" },
      },
    })
    expect(result.valid).toBe(true)
  })

  it("validates payload without optional fields", () => {
    const result = validateWebhookPayload({})
    expect(result.valid).toBe(true)
  })

  it("rejects payload with invalid sender", () => {
    const result = validateWebhookPayload({
      sender: { id: "not-a-number", login: 123 },
    })
    expect(result.valid).toBe(false)
  })
})

describe("GitHubRateLimitError", () => {
  it("creates error with correct properties", () => {
    const resetAt = new Date("2025-01-01T00:00:00Z")
    const err = new GitHubRateLimitError({
      retryAfterMs: 5000,
      remaining: 0,
      resetAt,
    })
    expect(err.name).toBe("GitHubRateLimitError")
    expect(err.retryAfterMs).toBe(5000)
    expect(err.remaining).toBe(0)
    expect(err.resetAt).toBe(resetAt)
    expect(err.message).toContain("5000ms")
  })

  it("supports custom message", () => {
    const err = new GitHubRateLimitError({
      message: "Custom rate limit",
      retryAfterMs: 1000,
      remaining: 0,
      resetAt: new Date(),
    })
    expect(err.message).toBe("Custom rate limit")
  })
})

describe("isRateLimitError", () => {
  it("returns true for GitHubRateLimitError", () => {
    const err = new GitHubRateLimitError({
      retryAfterMs: 1000,
      remaining: 0,
      resetAt: new Date(),
    })
    expect(isRateLimitError(err)).toBe(true)
  })

  it("returns false for regular Error", () => {
    expect(isRateLimitError(new Error("nope"))).toBe(false)
  })

  it("returns false for non-error values", () => {
    expect(isRateLimitError(null)).toBe(false)
    expect(isRateLimitError("string")).toBe(false)
  })
})

describe("parseRateLimitHeaders", () => {
  it("parses valid rate limit headers", () => {
    const now = Math.floor(Date.now() / 1000) + 60
    const headers = new Headers({
      "x-ratelimit-remaining": "10",
      "x-ratelimit-reset": String(now),
    })
    const result = parseRateLimitHeaders(headers)
    expect(result).not.toBeNull()
    expect(result!.remaining).toBe(10)
    expect(result!.retryAfterMs).toBeGreaterThan(0)
  })

  it("returns null when headers are missing", () => {
    const headers = new Headers({})
    expect(parseRateLimitHeaders(headers)).toBeNull()
  })

  it("returns null when only one header is present", () => {
    const headers = new Headers({ "x-ratelimit-remaining": "10" })
    expect(parseRateLimitHeaders(headers)).toBeNull()
  })
})

describe("lenientDecode", () => {
  const itemSchema = z.object({
    id: z.number(),
    name: z.string(),
  })

  it("parses all valid items", () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]
    const result = lenientDecode(items, itemSchema)
    expect(result.parsed).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
  })

  it("skips invalid items and continues", () => {
    const items = [
      { id: 1, name: "a" },
      { id: "bad", name: 123 },
      { id: 3, name: "c" },
    ]
    const result = lenientDecode(items, itemSchema)
    expect(result.parsed).toHaveLength(2)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].index).toBe(1)
  })

  it("handles empty array", () => {
    const result = lenientDecode([], itemSchema)
    expect(result.parsed).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })

  it("handles all invalid items", () => {
    const items = [{ bad: true }, null, "string"]
    const result = lenientDecode(items, itemSchema)
    expect(result.parsed).toHaveLength(0)
    expect(result.skipped).toHaveLength(3)
  })
})
