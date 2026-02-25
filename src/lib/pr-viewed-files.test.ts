import { describe, expect, it } from "vitest"
import {
  buildViewedFilesKey,
  getViewedFilesFromStorageValue,
  parseViewedFilesStorage,
  setViewedFilesInStorageValue,
  toggleViewedFile,
} from "./pr-viewed-files"

describe("pr-viewed-files utilities", () => {
  it("builds deterministic PR storage keys", () => {
    expect(buildViewedFilesKey("owner", "repo", 42)).toBe("owner/repo#42")
  })

  it("parses invalid storage values safely", () => {
    expect(parseViewedFilesStorage(null)).toEqual({})
    expect(parseViewedFilesStorage("not-json")).toEqual({})
    expect(parseViewedFilesStorage('{"x":1}')).toEqual({})
  })

  it("reads and writes per-PR viewed files", () => {
    const key = buildViewedFilesKey("owner", "repo", 1)
    const nextStorage = setViewedFilesInStorageValue(null, key, ["a.ts", "b.ts", "a.ts"])
    expect(getViewedFilesFromStorageValue(nextStorage, key)).toEqual(["a.ts", "b.ts"])
  })

  it("toggles viewed file state", () => {
    const once = toggleViewedFile([], "src/a.ts", true)
    expect(once).toEqual(["src/a.ts"])

    const removed = toggleViewedFile(once, "src/a.ts", false)
    expect(removed).toEqual([])
  })
})
