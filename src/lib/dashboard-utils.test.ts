import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  buildActivityFeed,
  buildNextActions,
  getLanguageDistribution,
  getDailyActivityCounts,
  formatTimeAgo,
  getGreeting,
  parseStringArray,
} from "./dashboard-utils"

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  name: "repo",
  fullName: "owner/repo",
  owner: "owner",
  pullRequests: [] as object[],
  issues: [] as object[],
  ...overrides,
})

const makePR = (overrides: Record<string, unknown> = {}) => ({
  id: "pr1",
  state: "open",
  number: 1,
  title: "Test PR",
  authorLogin: "alice",
  githubCreatedAt: Date.now() - 86400000,
  githubUpdatedAt: Date.now(),
  prReviews: [],
  prComments: [],
  prCommits: [],
  prChecks: [],
  ...overrides,
})

describe("buildActivityFeed", () => {
  it("returns merged PRs for current user", () => {
    const repos = [
      makeRepo({
        pullRequests: [
          makePR({
            id: "p1",
            mergedAt: 1000,
            authorLogin: "alice",
            number: 1,
          }),
        ],
      }),
    ]
    const items = buildActivityFeed(repos as never[], "alice")
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe("pr_merged")
    expect(items[0].title).toContain("1")
  })

  it("ignores merged PRs from other users", () => {
    const repos = [
      makeRepo({
        pullRequests: [makePR({ mergedAt: 1000, authorLogin: "bob", number: 1 })],
      }),
    ]
    expect(buildActivityFeed(repos as never[], "alice")).toHaveLength(0)
  })

  it("sorts by timestamp descending", () => {
    const repos = [
      makeRepo({
        pullRequests: [
          makePR({
            id: "p1",
            githubCreatedAt: 100,
            authorLogin: "alice",
            number: 1,
          }),
          makePR({
            id: "p2",
            mergedAt: 200,
            authorLogin: "alice",
            number: 2,
          }),
        ],
      }),
    ]
    const items = buildActivityFeed(repos as never[], "alice")
    expect(items).toHaveLength(2)
    expect(items[0].timestamp).toBe(200)
    expect(items[1].timestamp).toBe(100)
  })
})

describe("buildNextActions", () => {
  it("returns review requested for current user", () => {
    const repos = [
      makeRepo({
        pullRequests: [
          makePR({
            reviewRequestedBy: '["alice"]',
            authorLogin: "bob",
            number: 1,
          }),
        ],
      }),
    ]
    const actions = buildNextActions(repos as never[], "alice")
    expect(actions.some((a) => a.type === "review_requested")).toBe(true)
  })

  it("returns draft PR for current user", () => {
    const repos = [
      makeRepo({
        pullRequests: [makePR({ draft: true, authorLogin: "alice", number: 1 })],
      }),
    ]
    const actions = buildNextActions(repos as never[], "alice")
    expect(actions.some((a) => a.type === "draft_pr")).toBe(true)
  })

  it("returns open issue for current user", () => {
    const repos = [
      makeRepo({
        issues: [
          {
            id: "i1",
            state: "open",
            title: "Bug",
            number: 1,
            authorLogin: "alice",
          },
        ],
      }),
    ]
    const actions = buildNextActions(repos as never[], "alice")
    expect(actions.some((a) => a.type === "open_issue")).toBe(true)
  })
})

describe("getLanguageDistribution", () => {
  it("counts languages across repos", () => {
    const repos = [
      makeRepo({ language: "TypeScript" }),
      makeRepo({ language: "TypeScript" }),
      makeRepo({ language: "Python" }),
    ]
    const dist = getLanguageDistribution(repos as never[])
    expect(dist).toHaveLength(2)
    const ts = dist.find((d) => d.language === "TypeScript")
    const py = dist.find((d) => d.language === "Python")
    expect(ts?.count).toBe(2)
    expect(py?.count).toBe(1)
  })

  it("sorts by count descending", () => {
    const repos = [
      makeRepo({ language: "A" }),
      makeRepo({ language: "B" }),
      makeRepo({ language: "B" }),
    ]
    const dist = getLanguageDistribution(repos as never[])
    expect(dist[0].language).toBe("B")
    expect(dist[1].language).toBe("A")
  })
})

describe("getDailyActivityCounts", () => {
  it("returns date keys for requested days", () => {
    const dist = getDailyActivityCounts([], "alice", 3)
    expect(dist).toHaveLength(3)
    expect(dist.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true)
  })

  it("counts activity for current user", () => {
    const today = new Date().toISOString().slice(0, 10)
    const ts = new Date(today).getTime()
    const repos = [
      makeRepo({
        pullRequests: [
          makePR({
            githubCreatedAt: ts,
            authorLogin: "alice",
            number: 1,
          }),
        ],
      }),
    ]
    const dist = getDailyActivityCounts(repos as never[], "alice", 7)
    const todayEntry = dist.find((d) => d.date === today)
    expect(todayEntry?.count).toBe(1)
  })
})

describe("formatTimeAgo", () => {
  it("returns 'just now' for recent timestamp", () => {
    expect(formatTimeAgo(Date.now() - 1000)).toBe("just now")
  })

  it("returns minutes for < 1 hour", () => {
    expect(formatTimeAgo(Date.now() - 30 * 60000)).toMatch(/\d+m ago/)
  })

  it("returns date for old timestamp", () => {
    const old = Date.now() - 60 * 86400000
    expect(formatTimeAgo(old)).toMatch(/[A-Za-z]+ \d+/)
  })
})

describe("getGreeting", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns Good morning before noon", () => {
    vi.setSystemTime(new Date("2024-01-15T08:00:00Z"))
    expect(getGreeting()).toBe("Good morning")
  })

  it("returns Good afternoon before 5pm", () => {
    vi.setSystemTime(new Date("2024-01-15T14:00:00Z"))
    expect(getGreeting()).toBe("Good afternoon")
  })

  it("returns Good evening after 5pm", () => {
    vi.setSystemTime(new Date("2024-01-15T18:00:00Z"))
    expect(getGreeting()).toBe("Good evening")
  })
})

describe("parseStringArray", () => {
  it("parses JSON array", () => {
    expect(parseStringArray('["a","b"]')).toEqual(["a", "b"])
  })

  it("returns empty for null/undefined", () => {
    expect(parseStringArray(null)).toEqual([])
    expect(parseStringArray(undefined)).toEqual([])
  })

  it("returns empty for invalid JSON", () => {
    expect(parseStringArray("not json")).toEqual([])
  })

  it("returns empty for non-array JSON", () => {
    expect(parseStringArray('{"a":1}')).toEqual([])
  })
})
