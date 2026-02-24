import { describe, expect, it } from "vitest"
import {
  getPRLayoutMode,
  isFullScreenPRLayoutEnabled,
  setPRLayoutMode,
  type PRLayoutMode,
} from "./pr-layout-preference"

const createStorage = (
  initial: Record<string, string | null> = {},
): Pick<Storage, "getItem" | "setItem"> => {
  const data = new Map<string, string | null>(Object.entries(initial))

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe("pr-layout-preference", () => {
  it("defaults to standard layout when storage is unavailable", () => {
    expect(getPRLayoutMode(null)).toBe("default")
    expect(isFullScreenPRLayoutEnabled(null)).toBe(false)
  })

  it("defaults to standard layout on unknown stored value", () => {
    const storage = createStorage({ "bit:pr-layout-mode": "unknown-mode" })
    expect(getPRLayoutMode(storage)).toBe("default")
  })

  it("round-trips full screen mode through storage", () => {
    const storage = createStorage()
    const mode: PRLayoutMode = "full-screen-3-column"

    setPRLayoutMode(mode, storage)

    expect(getPRLayoutMode(storage)).toBe("full-screen-3-column")
    expect(isFullScreenPRLayoutEnabled(storage)).toBe(true)
  })

  it("round-trips default mode through storage", () => {
    const storage = createStorage()

    setPRLayoutMode("default", storage)

    expect(getPRLayoutMode(storage)).toBe("default")
    expect(isFullScreenPRLayoutEnabled(storage)).toBe(false)
  })
})
