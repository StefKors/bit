import { describe, expect, it } from "vitest"
import { formatSuggestedChangeBody } from "./github-client"

describe("formatSuggestedChangeBody", () => {
  it("formats a suggestion-only body", () => {
    const result = formatSuggestedChangeBody(undefined, "const next = 1")
    expect(result).toBe("```suggestion\nconst next = 1\n```")
  })

  it("includes optional comment body before suggestion block", () => {
    const result = formatSuggestedChangeBody("Please apply this.", "const next = 1")
    expect(result).toBe("Please apply this.\n\n```suggestion\nconst next = 1\n```")
  })

  it("normalizes newlines and removes trailing blank lines in suggestion", () => {
    const result = formatSuggestedChangeBody("Context", "line1\r\nline2\r\n\r\n")
    expect(result).toBe("Context\n\n```suggestion\nline1\nline2\n```")
  })
})
