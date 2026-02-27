import { describe, it, expect, beforeEach } from "vitest"
import { makeIssue, resetCounters } from "./test-helpers"
import {
  parseLabels,
  extractAuthors,
  extractLabels,
  filterByStatus,
  filterByAuthor,
  filterByLabels,
  sortIssues,
  applyFiltersAndSort,
  DEFAULT_ISSUE_FILTERS,
} from "./issue-filters"

beforeEach(() => {
  resetCounters()
})

// ── parseLabels ──

describe("parseLabels", () => {
  it("parses JSON array of strings", () => {
    expect(parseLabels('["bug","feature"]')).toEqual(["bug", "feature"])
  })

  it("parses JSON array of label objects", () => {
    expect(parseLabels('[{"name":"bug"}]')).toEqual(["bug"])
  })

  it("falls back to comma-separated on invalid JSON", () => {
    expect(parseLabels("bug, feature")).toEqual(["bug", "feature"])
  })

  it("returns empty for empty array", () => {
    expect(parseLabels("[]")).toEqual([])
  })
})

// ── extractAuthors ──

describe("extractAuthors", () => {
  it("extracts unique authors sorted", () => {
    const issues = [
      makeIssue({ authorLogin: "zara" }),
      makeIssue({ authorLogin: "alice" }),
      makeIssue({ authorLogin: "zara" }),
    ]
    expect(extractAuthors(issues).map((a) => a.login)).toEqual(["alice", "zara"])
  })

  it("skips issues without authorLogin", () => {
    const issues = [makeIssue({ authorLogin: null })]
    expect(extractAuthors(issues)).toEqual([])
  })

  it("returns empty for no issues", () => {
    expect(extractAuthors([])).toEqual([])
  })
})

// ── extractLabels ──

describe("extractLabels", () => {
  it("extracts unique labels sorted", () => {
    const issues = [makeIssue({ labels: '["bug","docs"]' }), makeIssue({ labels: '["bug"]' })]
    expect(extractLabels(issues)).toEqual(["bug", "docs"])
  })

  it("skips issues without labels", () => {
    const issues = [makeIssue({ labels: null })]
    expect(extractLabels(issues)).toEqual([])
  })
})

// ── filterByStatus ──

describe("filterByStatus", () => {
  const issues = [makeIssue({ state: "open" }), makeIssue({ state: "closed" })]

  it("returns all for 'all'", () => {
    expect(filterByStatus(issues, "all")).toHaveLength(2)
  })

  it("filters open issues", () => {
    expect(filterByStatus(issues, "open")).toHaveLength(1)
  })

  it("filters closed issues", () => {
    expect(filterByStatus(issues, "closed")).toHaveLength(1)
  })
})

// ── filterByAuthor ──

describe("filterByAuthor", () => {
  const issues = [makeIssue({ authorLogin: "alice" }), makeIssue({ authorLogin: "bob" })]

  it("returns all when author is null", () => {
    expect(filterByAuthor([...issues], null)).toHaveLength(2)
  })

  it("filters by author", () => {
    expect(filterByAuthor([...issues], "alice")).toHaveLength(1)
  })

  it("returns empty when no match", () => {
    expect(filterByAuthor([...issues], "charlie")).toHaveLength(0)
  })
})

// ── filterByLabels ──

describe("filterByLabels", () => {
  const issues = [
    makeIssue({ labels: '["bug"]' }),
    makeIssue({ labels: '["feature"]' }),
    makeIssue({ labels: null }),
  ]

  it("returns all when labels is empty", () => {
    expect(filterByLabels([...issues], [])).toHaveLength(3)
  })

  it("filters by matching label", () => {
    expect(filterByLabels([...issues], ["bug"])).toHaveLength(1)
  })
})

// ── sortIssues ──

describe("sortIssues", () => {
  it("sorts by updated descending", () => {
    const issues = [makeIssue({ githubUpdatedAt: 100 }), makeIssue({ githubUpdatedAt: 300 })]
    const sorted = sortIssues(issues, "updated", "desc")
    expect(sorted[0].githubUpdatedAt).toBe(300)
  })

  it("sorts by title ascending", () => {
    const issues = [makeIssue({ title: "Zeta" }), makeIssue({ title: "Alpha" })]
    const sorted = sortIssues(issues, "title", "asc")
    expect(sorted.map((i) => i.title)).toEqual(["Alpha", "Zeta"])
  })

  it("sorts by comments", () => {
    const issues = [makeIssue({ comments: 1 }), makeIssue({ comments: 5 })]
    const sorted = sortIssues(issues, "comments", "desc")
    expect(sorted[0].comments).toBe(5)
  })

  it("sorts by author", () => {
    const issues = [makeIssue({ authorLogin: "zara" }), makeIssue({ authorLogin: "alice" })]
    const sorted = sortIssues(issues, "author", "asc")
    expect(sorted[0].authorLogin).toBe("alice")
  })
})

// ── applyFiltersAndSort ──

describe("applyFiltersAndSort", () => {
  it("applies all filters and sorting together", () => {
    const issues = [
      makeIssue({ state: "open", authorLogin: "alice", title: "B" }),
      makeIssue({ state: "closed", authorLogin: "alice", title: "A" }),
      makeIssue({ state: "open", authorLogin: "bob", title: "C" }),
    ]
    const result = applyFiltersAndSort(issues, {
      ...DEFAULT_ISSUE_FILTERS,
      status: "open",
      author: "alice",
      sortBy: "title",
      sortDirection: "asc",
    })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("B")
  })

  it("returns all with default filters", () => {
    const issues = [makeIssue(), makeIssue()]
    expect(applyFiltersAndSort(issues, DEFAULT_ISSUE_FILTERS)).toHaveLength(2)
  })
})
