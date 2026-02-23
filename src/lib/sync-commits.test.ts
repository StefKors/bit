import { describe, it, expect } from "vitest"
import {
  buildCommitEntryId,
  buildCommitEntry,
  buildCommitEntries,
  computeStaleCommits,
  type GitHubCommit,
} from "./sync-commits"

const REPO_ID = "repo-abc-123"
const BRANCH = "main"
const NOW = 1700000000000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const makeCommit = (overrides: Partial<GitHubCommit> = {}): GitHubCommit => ({
  sha: "abc123def456",
  html_url: "https://github.com/StefKors/bit/commit/abc123def456",
  commit: {
    message: "Initial commit",
    author: { name: "Stef", email: "stef@example.com", date: "2024-01-15T10:00:00Z" },
    committer: { name: "Stef", email: "stef@example.com", date: "2024-01-15T10:00:00Z" },
  },
  author: { login: "StefKors", avatar_url: "https://avatars.githubusercontent.com/u/123" },
  committer: { login: "StefKors" },
  ...overrides,
})

describe("buildCommitEntryId", () => {
  it("produces a valid UUID", () => {
    const id = buildCommitEntryId(REPO_ID, BRANCH, "abc123")
    expect(id).toMatch(UUID_RE)
  })

  it("returns the same ID for the same inputs", () => {
    const id1 = buildCommitEntryId(REPO_ID, BRANCH, "sha1")
    const id2 = buildCommitEntryId(REPO_ID, BRANCH, "sha1")
    expect(id1).toBe(id2)
  })

  it("returns different IDs for different shas", () => {
    const id1 = buildCommitEntryId(REPO_ID, BRANCH, "sha1")
    const id2 = buildCommitEntryId(REPO_ID, BRANCH, "sha2")
    expect(id1).not.toBe(id2)
  })

  it("returns different IDs for different branches", () => {
    const id1 = buildCommitEntryId(REPO_ID, "main", "sha1")
    const id2 = buildCommitEntryId(REPO_ID, "develop", "sha1")
    expect(id1).not.toBe(id2)
  })
})

describe("buildCommitEntry", () => {
  it("transforms a commit correctly", () => {
    const commit = makeCommit()
    const entry = buildCommitEntry(commit, REPO_ID, BRANCH, NOW)

    expect(entry.id).toMatch(UUID_RE)
    expect(entry.sha).toBe(commit.sha)
    expect(entry.message).toBe("Initial commit")
    expect(entry.authorLogin).toBe("StefKors")
    expect(entry.authorAvatarUrl).toBe("https://avatars.githubusercontent.com/u/123")
    expect(entry.authorName).toBe("Stef")
    expect(entry.authorEmail).toBe("stef@example.com")
    expect(entry.committerLogin).toBe("StefKors")
    expect(entry.committerName).toBe("Stef")
    expect(entry.committerEmail).toBe("stef@example.com")
    expect(entry.htmlUrl).toBe(commit.html_url)
    expect(entry.ref).toBe(BRANCH)
    expect(entry.repoId).toBe(REPO_ID)
    expect(entry.committedAt).toBe(new Date("2024-01-15T10:00:00Z").getTime())
    expect(entry.createdAt).toBe(NOW)
    expect(entry.updatedAt).toBe(NOW)
  })

  it("handles missing author info gracefully", () => {
    const commit = makeCommit({
      author: null,
      committer: null,
      commit: {
        message: "bot commit",
        author: null,
        committer: null,
      },
    })

    const entry = buildCommitEntry(commit, REPO_ID, BRANCH, NOW)

    expect(entry.authorLogin).toBeUndefined()
    expect(entry.authorAvatarUrl).toBeUndefined()
    expect(entry.authorName).toBeUndefined()
    expect(entry.authorEmail).toBeUndefined()
    expect(entry.committerLogin).toBeUndefined()
    expect(entry.committerName).toBeUndefined()
    expect(entry.committerEmail).toBeUndefined()
    expect(entry.committedAt).toBeUndefined()
  })

  it("handles commit with no committer date", () => {
    const commit = makeCommit({
      commit: {
        message: "no date",
        committer: { name: "Stef" },
      },
    })

    const entry = buildCommitEntry(commit, REPO_ID, BRANCH, NOW)
    expect(entry.committedAt).toBeUndefined()
  })
})

describe("buildCommitEntries", () => {
  it("transforms multiple commits", () => {
    const commits = [
      makeCommit({ sha: "sha1" }),
      makeCommit({ sha: "sha2" }),
      makeCommit({ sha: "sha3" }),
    ]

    const entries = buildCommitEntries(commits, REPO_ID, BRANCH, NOW)

    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.sha)).toEqual(["sha1", "sha2", "sha3"])
  })

  it("returns empty array for empty input", () => {
    const entries = buildCommitEntries([], REPO_ID, BRANCH, NOW)
    expect(entries).toEqual([])
  })

  it("produces unique IDs for all entries", () => {
    const commits = [makeCommit({ sha: "sha1" }), makeCommit({ sha: "sha2" })]

    const entries = buildCommitEntries(commits, REPO_ID, BRANCH, NOW)
    const ids = entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("is idempotent — same input produces same output", () => {
    const commits = [makeCommit({ sha: "sha1" })]

    const entries1 = buildCommitEntries(commits, REPO_ID, BRANCH, NOW)
    const entries2 = buildCommitEntries(commits, REPO_ID, BRANCH, NOW)

    expect(entries1).toEqual(entries2)
  })

  it("concurrent syncs produce entries with the same IDs", () => {
    const commits = [makeCommit({ sha: "sha1" })]

    const sync1 = buildCommitEntries(commits, REPO_ID, BRANCH, NOW)
    const sync2 = buildCommitEntries(commits, REPO_ID, BRANCH, NOW + 5000)

    expect(sync1[0].id).toBe(sync2[0].id)
  })
})

describe("computeStaleCommits", () => {
  it("returns IDs of commits not in the incoming set", () => {
    const existing = [
      { id: "id-1", sha: "sha1" },
      { id: "id-2", sha: "sha2" },
      { id: "id-3", sha: "sha3" },
    ]
    const incoming = new Set(["sha1", "sha3"])

    const stale = computeStaleCommits(existing, incoming)
    expect(stale).toEqual(["id-2"])
  })

  it("returns empty array when all commits still present", () => {
    const existing = [
      { id: "id-1", sha: "sha1" },
      { id: "id-2", sha: "sha2" },
    ]
    const incoming = new Set(["sha1", "sha2"])

    const stale = computeStaleCommits(existing, incoming)
    expect(stale).toEqual([])
  })

  it("returns all IDs when incoming set is empty (branch reset)", () => {
    const existing = [
      { id: "id-1", sha: "sha1" },
      { id: "id-2", sha: "sha2" },
    ]

    const stale = computeStaleCommits(existing, new Set())
    expect(stale).toEqual(["id-1", "id-2"])
  })

  it("returns empty array when existing is empty", () => {
    const stale = computeStaleCommits([], new Set(["sha1"]))
    expect(stale).toEqual([])
  })
})
