import { describe, it, expect } from "vitest"
import { deterministicId } from "./deterministic-id"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("deterministicId", () => {
  it("produces a valid UUID v5 format", () => {
    const id = deterministicId("a", "b", "c")
    expect(id).toMatch(UUID_RE)
  })

  it("is deterministic — same inputs produce the same output", () => {
    const id1 = deterministicId("repo", "main", "src/index.ts")
    const id2 = deterministicId("repo", "main", "src/index.ts")
    expect(id1).toBe(id2)
  })

  it("produces different IDs for different inputs", () => {
    const id1 = deterministicId("repo", "main", "a.ts")
    const id2 = deterministicId("repo", "main", "b.ts")
    expect(id1).not.toBe(id2)
  })

  it("is sensitive to part ordering", () => {
    const id1 = deterministicId("a", "b")
    const id2 = deterministicId("b", "a")
    expect(id1).not.toBe(id2)
  })

  it("handles a single part", () => {
    const id = deterministicId("single")
    expect(id).toMatch(UUID_RE)
  })

  it("handles many parts", () => {
    const id = deterministicId("a", "b", "c", "d", "e", "f")
    expect(id).toMatch(UUID_RE)
  })

  it("handles parts with special characters", () => {
    const id = deterministicId("repo-id", "feature/branch", "src/components/UI.tsx")
    expect(id).toMatch(UUID_RE)
  })

  it("differentiates namespaces to avoid collisions", () => {
    const treeId = deterministicId("repoTree", "repo1", "main", "README.md")
    const commitId = deterministicId("repoCommit", "repo1", "main", "README.md")
    expect(treeId).not.toBe(commitId)
  })
})
