import { describe, it, expect } from "vitest"
import { rewriteImageUrl, type RepoContext } from "./markdown-images"

const ctx: RepoContext = { owner: "StefKors", repo: "bit", branch: "main" }
const RAW = "https://raw.githubusercontent.com/StefKors/bit/main"

describe("rewriteImageUrl", () => {
  // Relative paths
  it("rewrites a simple relative path", () => {
    expect(rewriteImageUrl("public/logo.png", ctx)).toBe(`${RAW}/public/logo.png`)
  })

  it("rewrites a ./ prefixed path", () => {
    expect(rewriteImageUrl("./public/logo.png", ctx)).toBe(`${RAW}/public/logo.png`)
  })

  it("rewrites a root-level file", () => {
    expect(rewriteImageUrl("screenshot.png", ctx)).toBe(`${RAW}/screenshot.png`)
  })

  it("rewrites deeply nested paths", () => {
    expect(rewriteImageUrl("docs/images/arch/diagram.svg", ctx)).toBe(
      `${RAW}/docs/images/arch/diagram.svg`,
    )
  })

  // Absolute URLs — should pass through unchanged
  it("does not rewrite https URLs", () => {
    const url = "https://example.com/image.png"
    expect(rewriteImageUrl(url, ctx)).toBe(url)
  })

  it("does not rewrite http URLs", () => {
    const url = "http://example.com/image.png"
    expect(rewriteImageUrl(url, ctx)).toBe(url)
  })

  it("does not rewrite protocol-relative URLs", () => {
    const url = "//cdn.example.com/image.png"
    expect(rewriteImageUrl(url, ctx)).toBe(url)
  })

  it("does not rewrite data URIs", () => {
    const url = "data:image/png;base64,iVBORw0KGgo="
    expect(rewriteImageUrl(url, ctx)).toBe(url)
  })

  it("does not rewrite anchor links", () => {
    expect(rewriteImageUrl("#section", ctx)).toBe("#section")
  })

  // No context — should pass through unchanged
  it("returns src unchanged when no context provided", () => {
    expect(rewriteImageUrl("logo.png")).toBe("logo.png")
  })

  it("returns src unchanged when context is undefined", () => {
    expect(rewriteImageUrl("logo.png", undefined)).toBe("logo.png")
  })

  // Edge cases
  it("returns empty string for empty src", () => {
    expect(rewriteImageUrl("", ctx)).toBe("")
  })

  it("handles paths with spaces", () => {
    expect(rewriteImageUrl("my images/logo.png", ctx)).toBe(`${RAW}/my images/logo.png`)
  })

  it("uses the correct branch", () => {
    const devCtx = { owner: "StefKors", repo: "bit", branch: "develop" }
    expect(rewriteImageUrl("logo.png", devCtx)).toBe(
      "https://raw.githubusercontent.com/StefKors/bit/develop/logo.png",
    )
  })
})
