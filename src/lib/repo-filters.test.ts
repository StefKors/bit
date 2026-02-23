import { describe, it, expect, beforeEach } from "vitest"
import { makeRepo, resetCounters } from "./test-helpers"
import {
  extractLanguages,
  applyFiltersAndSort,
  checkActiveFilters,
  DEFAULT_REPO_FILTERS,
} from "./repo-filters"

beforeEach(() => resetCounters())

// ── extractLanguages ──

describe("extractLanguages", () => {
  it("extracts unique languages sorted", () => {
    const repos = [
      makeRepo({ language: "TypeScript" }),
      makeRepo({ language: "Python" }),
      makeRepo({ language: "TypeScript" }),
    ]
    expect(extractLanguages(repos)).toEqual(["Python", "TypeScript"])
  })

  it("skips repos without language", () => {
    const repos = [makeRepo({ language: null }), makeRepo({ language: "Go" })]
    expect(extractLanguages(repos)).toEqual(["Go"])
  })

  it("returns empty for no repos", () => {
    expect(extractLanguages([])).toEqual([])
  })
})

// ── applyFiltersAndSort ──

describe("applyFiltersAndSort", () => {
  it("returns all with default filters", () => {
    const repos = [makeRepo(), makeRepo()]
    expect(applyFiltersAndSort(repos, DEFAULT_REPO_FILTERS)).toHaveLength(2)
  })

  // Search
  it("filters by search term (name)", () => {
    const repos = [makeRepo({ name: "my-app" }), makeRepo({ name: "other" })]
    const result = applyFiltersAndSort(repos, { ...DEFAULT_REPO_FILTERS, search: "my-app" })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("my-app")
  })

  it("search is case-insensitive", () => {
    const repos = [makeRepo({ name: "MyApp" })]
    const result = applyFiltersAndSort(repos, { ...DEFAULT_REPO_FILTERS, search: "myapp" })
    expect(result).toHaveLength(1)
  })

  // Type filter
  it("filters source repos (non-forks)", () => {
    const repos = [makeRepo({ fork: false }), makeRepo({ fork: true })]
    const result = applyFiltersAndSort(repos, { ...DEFAULT_REPO_FILTERS, type: "source" })
    expect(result).toHaveLength(1)
    expect(result[0].fork).toBe(false)
  })

  it("filters fork repos", () => {
    const repos = [makeRepo({ fork: false }), makeRepo({ fork: true })]
    const result = applyFiltersAndSort(repos, { ...DEFAULT_REPO_FILTERS, type: "fork" })
    expect(result).toHaveLength(1)
    expect(result[0].fork).toBe(true)
  })

  // Language filter
  it("filters by language", () => {
    const repos = [makeRepo({ language: "TypeScript" }), makeRepo({ language: "Python" })]
    const result = applyFiltersAndSort(repos, {
      ...DEFAULT_REPO_FILTERS,
      language: "TypeScript",
    })
    expect(result).toHaveLength(1)
  })

  // Sorting
  it("sorts by name ascending", () => {
    const repos = [makeRepo({ name: "zeta" }), makeRepo({ name: "alpha" })]
    const result = applyFiltersAndSort(repos, {
      ...DEFAULT_REPO_FILTERS,
      sortBy: "name",
      sortDirection: "asc",
    })
    expect(result.map((r) => r.name)).toEqual(["alpha", "zeta"])
  })

  it("sorts by stars descending", () => {
    const repos = [makeRepo({ stargazersCount: 10 }), makeRepo({ stargazersCount: 100 })]
    const result = applyFiltersAndSort(repos, {
      ...DEFAULT_REPO_FILTERS,
      sortBy: "stars",
      sortDirection: "desc",
    })
    expect(result[0].stargazersCount).toBe(100)
  })

  it("sorts by forks descending", () => {
    const repos = [makeRepo({ forksCount: 5 }), makeRepo({ forksCount: 50 })]
    const result = applyFiltersAndSort(repos, {
      ...DEFAULT_REPO_FILTERS,
      sortBy: "forks",
      sortDirection: "desc",
    })
    expect(result[0].forksCount).toBe(50)
  })

  it("sorts by updated descending", () => {
    const repos = [
      makeRepo({ githubUpdatedAt: 100 }),
      makeRepo({ githubUpdatedAt: 300 }),
    ]
    const result = applyFiltersAndSort(repos, DEFAULT_REPO_FILTERS)
    expect(result[0].githubUpdatedAt).toBe(300)
  })

  // Combined
  it("applies search + type + language + sort together", () => {
    const repos = [
      makeRepo({ name: "ts-app", language: "TypeScript", fork: false, stargazersCount: 50 }),
      makeRepo({ name: "ts-lib", language: "TypeScript", fork: false, stargazersCount: 100 }),
      makeRepo({ name: "py-app", language: "Python", fork: false, stargazersCount: 200 }),
      makeRepo({ name: "ts-fork", language: "TypeScript", fork: true, stargazersCount: 10 }),
    ]
    const result = applyFiltersAndSort(repos, {
      search: "ts",
      type: "source",
      language: "TypeScript",
      sortBy: "stars",
      sortDirection: "desc",
    })
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("ts-lib")
    expect(result[1].name).toBe("ts-app")
  })
})

// ── checkActiveFilters ──

describe("checkActiveFilters", () => {
  it("returns false for default filters", () => {
    expect(checkActiveFilters(DEFAULT_REPO_FILTERS)).toBe(false)
  })

  it("returns true when search is set", () => {
    expect(checkActiveFilters({ ...DEFAULT_REPO_FILTERS, search: "foo" })).toBe(true)
  })

  it("returns true when type is changed", () => {
    expect(checkActiveFilters({ ...DEFAULT_REPO_FILTERS, type: "fork" })).toBe(true)
  })

  it("returns true when language is set", () => {
    expect(checkActiveFilters({ ...DEFAULT_REPO_FILTERS, language: "Go" })).toBe(true)
  })

  it("returns true when sortBy is changed", () => {
    expect(checkActiveFilters({ ...DEFAULT_REPO_FILTERS, sortBy: "stars" })).toBe(true)
  })
})
