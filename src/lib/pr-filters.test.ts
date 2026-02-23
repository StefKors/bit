import { describe, it, expect, beforeEach } from "vitest"
import { makePR, resetCounters } from "./test-helpers"
import {
  parseLabels,
  extractAuthors,
  extractLabels,
  filterByStatus,
  filterByDraft,
  filterByAuthor,
  filterByLabels,
  sortPRs,
  applyFiltersAndSort,
  parseFiltersFromSearch,
  filtersToSearchParams,
  hasActiveFilters,
  DEFAULT_PR_FILTERS,
} from "./pr-filters"

beforeEach(() => resetCounters())

// ── parseLabels ──

describe("parseLabels", () => {
  it("parses JSON array of strings", () => {
    expect(parseLabels('["bug","feature"]')).toEqual(["bug", "feature"])
  })

  it("parses JSON array of label objects", () => {
    expect(parseLabels('[{"name":"bug"},{"name":"feature"}]')).toEqual(["bug", "feature"])
  })

  it("parses mixed array of strings and objects", () => {
    expect(parseLabels('["bug",{"name":"feature"}]')).toEqual(["bug", "feature"])
  })

  it("falls back to comma-separated parsing on invalid JSON", () => {
    expect(parseLabels("bug, feature, fix")).toEqual(["bug", "feature", "fix"])
  })

  it("returns empty array for empty JSON array", () => {
    expect(parseLabels("[]")).toEqual([])
  })

  it("filters out empty strings", () => {
    expect(parseLabels('["bug","","feature"]')).toEqual(["bug", "feature"])
  })

  it("handles objects without name property", () => {
    expect(parseLabels('[{"id":1},{"name":"bug"}]')).toEqual(["bug"])
  })
})

// ── extractAuthors ──

describe("extractAuthors", () => {
  it("extracts unique authors sorted alphabetically", () => {
    const prs = [
      makePR({ authorLogin: "zara" }),
      makePR({ authorLogin: "alice" }),
      makePR({ authorLogin: "zara" }),
    ]
    const authors = extractAuthors(prs)
    expect(authors.map((a) => a.login)).toEqual(["alice", "zara"])
  })

  it("skips PRs without authorLogin", () => {
    const prs = [makePR({ authorLogin: "alice" }), makePR({ authorLogin: null })]
    expect(extractAuthors(prs)).toHaveLength(1)
  })

  it("returns empty array for no PRs", () => {
    expect(extractAuthors([])).toEqual([])
  })
})

// ── extractLabels ──

describe("extractLabels", () => {
  it("extracts unique labels sorted", () => {
    const prs = [
      makePR({ labels: '["bug","feature"]' }),
      makePR({ labels: '["bug","docs"]' }),
    ]
    expect(extractLabels(prs)).toEqual(["bug", "docs", "feature"])
  })

  it("skips PRs without labels", () => {
    const prs = [makePR({ labels: null }), makePR({ labels: '["bug"]' })]
    expect(extractLabels(prs)).toEqual(["bug"])
  })
})

// ── filterByStatus ──

describe("filterByStatus", () => {
  const prs = [
    makePR({ state: "open", merged: false }),
    makePR({ state: "closed", merged: false }),
    makePR({ state: "closed", merged: true }),
  ]

  it("returns all for 'all'", () => {
    expect(filterByStatus(prs, "all")).toHaveLength(3)
  })

  it("filters open PRs", () => {
    const result = filterByStatus(prs, "open")
    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("open")
  })

  it("filters closed (non-merged) PRs", () => {
    const result = filterByStatus(prs, "closed")
    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("closed")
    expect(result[0].merged).toBe(false)
  })

  it("filters merged PRs", () => {
    const result = filterByStatus(prs, "merged")
    expect(result).toHaveLength(1)
    expect(result[0].merged).toBe(true)
  })
})

// ── filterByDraft ──

describe("filterByDraft", () => {
  const prs = [makePR({ draft: true }), makePR({ draft: false })]

  it("returns all for 'all'", () => {
    expect(filterByDraft([...prs], "all")).toHaveLength(2)
  })

  it("filters draft PRs", () => {
    expect(filterByDraft([...prs], "draft")).toHaveLength(1)
  })

  it("filters ready PRs", () => {
    expect(filterByDraft([...prs], "ready")).toHaveLength(1)
  })
})

// ── filterByAuthor ──

describe("filterByAuthor", () => {
  const prs = [makePR({ authorLogin: "alice" }), makePR({ authorLogin: "bob" })]

  it("returns all when author is null", () => {
    expect(filterByAuthor([...prs], null)).toHaveLength(2)
  })

  it("filters by specific author", () => {
    const result = filterByAuthor([...prs], "alice")
    expect(result).toHaveLength(1)
    expect(result[0].authorLogin).toBe("alice")
  })
})

// ── filterByLabels ──

describe("filterByLabels", () => {
  const prs = [
    makePR({ labels: '["bug"]' }),
    makePR({ labels: '["feature"]' }),
    makePR({ labels: null }),
  ]

  it("returns all when labels is empty", () => {
    expect(filterByLabels([...prs], [])).toHaveLength(3)
  })

  it("filters PRs matching any of the given labels", () => {
    expect(filterByLabels([...prs], ["bug"])).toHaveLength(1)
  })

  it("excludes PRs with no labels", () => {
    expect(filterByLabels([...prs], ["bug", "feature"])).toHaveLength(2)
  })
})

// ── sortPRs ──

describe("sortPRs", () => {
  it("sorts by updated descending", () => {
    const prs = [
      makePR({ githubUpdatedAt: 100 }),
      makePR({ githubUpdatedAt: 300 }),
      makePR({ githubUpdatedAt: 200 }),
    ]
    const sorted = sortPRs(prs, "updated", "desc")
    expect(sorted.map((p) => p.githubUpdatedAt)).toEqual([300, 200, 100])
  })

  it("sorts by title ascending", () => {
    const prs = [makePR({ title: "Zeta" }), makePR({ title: "Alpha" })]
    const sorted = sortPRs(prs, "title", "asc")
    expect(sorted.map((p) => p.title)).toEqual(["Alpha", "Zeta"])
  })

  it("sorts by comments (sum of comments + reviewComments)", () => {
    const prs = [
      makePR({ comments: 1, reviewComments: 2 }),
      makePR({ comments: 5, reviewComments: 0 }),
    ]
    const sorted = sortPRs(prs, "comments", "desc")
    expect(sorted[0].comments).toBe(5)
  })
})

// ── applyFiltersAndSort ──

describe("applyFiltersAndSort", () => {
  it("applies all filters and sorting together", () => {
    const prs = [
      makePR({ state: "open", authorLogin: "alice", title: "B" }),
      makePR({ state: "closed", authorLogin: "alice", title: "A" }),
      makePR({ state: "open", authorLogin: "bob", title: "C" }),
    ]
    const result = applyFiltersAndSort(prs, {
      ...DEFAULT_PR_FILTERS,
      status: "open",
      author: "alice",
      sortBy: "title",
      sortDirection: "asc",
    })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("B")
  })

  it("returns all with default filters", () => {
    const prs = [makePR(), makePR(), makePR()]
    expect(applyFiltersAndSort(prs, DEFAULT_PR_FILTERS)).toHaveLength(3)
  })
})

// ── parseFiltersFromSearch ──

describe("parseFiltersFromSearch", () => {
  it("returns defaults for empty search", () => {
    expect(parseFiltersFromSearch({})).toEqual(DEFAULT_PR_FILTERS)
  })

  it("parses valid values", () => {
    const result = parseFiltersFromSearch({ status: "open", draft: "draft", sortBy: "created" })
    expect(result.status).toBe("open")
    expect(result.draft).toBe("draft")
    expect(result.sortBy).toBe("created")
  })

  it("ignores invalid values and uses defaults", () => {
    const result = parseFiltersFromSearch({ status: "invalid", sortBy: "nope" })
    expect(result.status).toBe("all")
    expect(result.sortBy).toBe("updated")
  })
})

// ── filtersToSearchParams ──

describe("filtersToSearchParams", () => {
  it("returns empty object for default filters", () => {
    expect(filtersToSearchParams(DEFAULT_PR_FILTERS)).toEqual({})
  })

  it("only includes non-default values", () => {
    const params = filtersToSearchParams({ ...DEFAULT_PR_FILTERS, status: "open" })
    expect(params).toEqual({ status: "open" })
  })
})

// ── hasActiveFilters ──

describe("hasActiveFilters", () => {
  it("returns false for default filters", () => {
    expect(hasActiveFilters(DEFAULT_PR_FILTERS)).toBe(false)
  })

  it("returns true when status is changed", () => {
    expect(hasActiveFilters({ ...DEFAULT_PR_FILTERS, status: "open" })).toBe(true)
  })

  it("returns true when labels are set", () => {
    expect(hasActiveFilters({ ...DEFAULT_PR_FILTERS, labels: ["bug"] })).toBe(true)
  })
})
