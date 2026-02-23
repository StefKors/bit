import { describe, it, expect } from "vitest"
import {
  buildTreeEntryId,
  buildTreeEntry,
  buildTreeEntries,
  computeStaleEntries,
  type GitHubTreeItem,
} from "./sync-trees"

const REPO_ID = "repo-abc-123"
const BRANCH = "main"
const OWNER = "StefKors"
const REPO = "bit"
const NOW = 1700000000000

describe("buildTreeEntryId", () => {
  it("produces a deterministic ID from repoId, branch, and path", () => {
    const id = buildTreeEntryId(REPO_ID, BRANCH, "src/index.ts")
    expect(id).toBe("repo-abc-123:main:src/index.ts")
  })

  it("returns the same ID for the same inputs", () => {
    const id1 = buildTreeEntryId(REPO_ID, BRANCH, "README.md")
    const id2 = buildTreeEntryId(REPO_ID, BRANCH, "README.md")
    expect(id1).toBe(id2)
  })

  it("returns different IDs for different paths", () => {
    const id1 = buildTreeEntryId(REPO_ID, BRANCH, "src/a.ts")
    const id2 = buildTreeEntryId(REPO_ID, BRANCH, "src/b.ts")
    expect(id1).not.toBe(id2)
  })

  it("returns different IDs for different branches", () => {
    const id1 = buildTreeEntryId(REPO_ID, "main", "README.md")
    const id2 = buildTreeEntryId(REPO_ID, "develop", "README.md")
    expect(id1).not.toBe(id2)
  })

  it("returns different IDs for different repos", () => {
    const id1 = buildTreeEntryId("repo-1", BRANCH, "README.md")
    const id2 = buildTreeEntryId("repo-2", BRANCH, "README.md")
    expect(id1).not.toBe(id2)
  })
})

describe("buildTreeEntry", () => {
  it("transforms a file item correctly", () => {
    const item: GitHubTreeItem = {
      path: "src/index.ts",
      type: "blob",
      sha: "abc123",
      size: 1024,
      url: "https://api.github.com/repos/StefKors/bit/git/blobs/abc123",
    }

    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(`${REPO_ID}:${BRANCH}:src/index.ts`)
    expect(entry!.ref).toBe(BRANCH)
    expect(entry!.path).toBe("src/index.ts")
    expect(entry!.name).toBe("index.ts")
    expect(entry!.type).toBe("file")
    expect(entry!.sha).toBe("abc123")
    expect(entry!.size).toBe(1024)
    expect(entry!.htmlUrl).toBe(`https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/src/index.ts`)
    expect(entry!.repoId).toBe(REPO_ID)
    expect(entry!.createdAt).toBe(NOW)
    expect(entry!.updatedAt).toBe(NOW)
  })

  it("transforms a directory item correctly", () => {
    const item: GitHubTreeItem = {
      path: "src/components",
      type: "tree",
      sha: "def456",
    }

    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entry).not.toBeNull()
    expect(entry!.type).toBe("dir")
    expect(entry!.name).toBe("components")
    expect(entry!.htmlUrl).toBe(`https://github.com/${OWNER}/${REPO}/tree/${BRANCH}/src/components`)
  })

  it("returns null for items without a path", () => {
    const item: GitHubTreeItem = { type: "blob", sha: "abc" }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)
    expect(entry).toBeNull()
  })

  it("handles root-level files (no slashes in path)", () => {
    const item: GitHubTreeItem = { path: "README.md", type: "blob", sha: "aaa" }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entry!.name).toBe("README.md")
    expect(entry!.path).toBe("README.md")
  })

  it("handles deeply nested paths", () => {
    const item: GitHubTreeItem = {
      path: "src/features/repo/components/FileTree.tsx",
      type: "blob",
      sha: "bbb",
    }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entry!.name).toBe("FileTree.tsx")
    expect(entry!.path).toBe("src/features/repo/components/FileTree.tsx")
  })

  it("defaults sha to empty string when missing", () => {
    const item: GitHubTreeItem = { path: "file.txt", type: "blob" }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)
    expect(entry!.sha).toBe("")
  })

  it("leaves size undefined when not provided", () => {
    const item: GitHubTreeItem = { path: "file.txt", type: "blob", sha: "x" }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)
    expect(entry!.size).toBeUndefined()
  })

  it("treats unknown types as file", () => {
    const item: GitHubTreeItem = { path: "submodule", type: "commit", sha: "x" }
    const entry = buildTreeEntry(item, REPO_ID, BRANCH, OWNER, REPO, NOW)
    expect(entry!.type).toBe("file")
  })
})

describe("buildTreeEntries", () => {
  it("transforms multiple items and filters out items without paths", () => {
    const items: GitHubTreeItem[] = [
      { path: "src", type: "tree", sha: "a1" },
      { path: "src/index.ts", type: "blob", sha: "a2", size: 500 },
      { type: "blob", sha: "a3" }, // no path — should be filtered
      { path: "README.md", type: "blob", sha: "a4", size: 200 },
    ]

    const entries = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.path)).toEqual(["src", "src/index.ts", "README.md"])
  })

  it("returns empty array for empty input", () => {
    const entries = buildTreeEntries([], REPO_ID, BRANCH, OWNER, REPO, NOW)
    expect(entries).toEqual([])
  })

  it("produces unique IDs for all entries", () => {
    const items: GitHubTreeItem[] = [
      { path: "a.ts", type: "blob", sha: "1" },
      { path: "b.ts", type: "blob", sha: "2" },
      { path: "c/d.ts", type: "blob", sha: "3" },
    ]

    const entries = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW)
    const ids = entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("produces identical output for identical input (idempotent)", () => {
    const items: GitHubTreeItem[] = [
      { path: "src/index.ts", type: "blob", sha: "abc", size: 100 },
      { path: "src/lib", type: "tree", sha: "def" },
    ]

    const entries1 = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW)
    const entries2 = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW)

    expect(entries1).toEqual(entries2)
  })

  it("concurrent syncs produce entries with the same IDs", () => {
    const items: GitHubTreeItem[] = [{ path: "file.ts", type: "blob", sha: "abc" }]

    const sync1 = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW)
    const sync2 = buildTreeEntries(items, REPO_ID, BRANCH, OWNER, REPO, NOW + 1000)

    expect(sync1[0].id).toBe(sync2[0].id)
  })
})

describe("computeStaleEntries", () => {
  it("returns IDs of entries not in the incoming set", () => {
    const existing = [
      { id: "id-1", path: "a.ts" },
      { id: "id-2", path: "b.ts" },
      { id: "id-3", path: "c.ts" },
    ]
    const incoming = new Set(["a.ts", "c.ts"])

    const stale = computeStaleEntries(existing, incoming)
    expect(stale).toEqual(["id-2"])
  })

  it("returns empty array when all entries are still present", () => {
    const existing = [
      { id: "id-1", path: "a.ts" },
      { id: "id-2", path: "b.ts" },
    ]
    const incoming = new Set(["a.ts", "b.ts"])

    const stale = computeStaleEntries(existing, incoming)
    expect(stale).toEqual([])
  })

  it("returns all IDs when incoming set is empty", () => {
    const existing = [
      { id: "id-1", path: "a.ts" },
      { id: "id-2", path: "b.ts" },
    ]

    const stale = computeStaleEntries(existing, new Set())
    expect(stale).toEqual(["id-1", "id-2"])
  })

  it("returns empty array when existing is empty", () => {
    const stale = computeStaleEntries([], new Set(["a.ts"]))
    expect(stale).toEqual([])
  })

  it("handles new files being added (no stale entries)", () => {
    const existing = [{ id: "id-1", path: "old.ts" }]
    const incoming = new Set(["old.ts", "new.ts"])

    const stale = computeStaleEntries(existing, incoming)
    expect(stale).toEqual([])
  })
})
