import { describe, it, expect } from "vitest"
import { isValidCerebrasModelId, CEREBRAS_MODELS, DEFAULT_MODEL } from "./cerebras"

describe("isValidCerebrasModelId", () => {
  it("returns true for valid model ids", () => {
    for (const m of CEREBRAS_MODELS) {
      expect(isValidCerebrasModelId(m.id)).toBe(true)
    }
  })

  it("returns true for default model", () => {
    expect(isValidCerebrasModelId(DEFAULT_MODEL)).toBe(true)
  })

  it("returns false for invalid model ids", () => {
    expect(isValidCerebrasModelId("")).toBe(false)
    expect(isValidCerebrasModelId("gpt-4")).toBe(false)
    expect(isValidCerebrasModelId("llama-4-scout")).toBe(false)
    expect(isValidCerebrasModelId("llama3.3-70b ")).toBe(false)
  })
})
