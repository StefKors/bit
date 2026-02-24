import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubPullRequest = InstaQLEntity<AppSchema, "pullRequests">

// Filter types
export type PRStatus = "all" | "open" | "closed" | "merged"
export type PRDraftFilter = "all" | "draft" | "ready"
export type PRSortField = "updated" | "created" | "comments" | "title" | "author"
export type PRSortDirection = "desc" | "asc"

export interface PRFilters {
  status: PRStatus
  author: string | null
  labels: string[]
  draft: PRDraftFilter
  sortBy: PRSortField
  sortDirection: PRSortDirection
}

export const DEFAULT_PR_FILTERS: PRFilters = {
  status: "open",
  author: null,
  labels: [],
  draft: "all",
  sortBy: "updated",
  sortDirection: "desc",
}

// Filter option definitions
export const STATUS_OPTIONS: { value: PRStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
]

export const DRAFT_OPTIONS: { value: PRDraftFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready for review" },
]

export const SORT_OPTIONS: { value: PRSortField; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Newest" },
  { value: "comments", label: "Most comments" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
]

// Label parsing helper
interface LabelObject {
  name?: string
}

export const parseLabels = (labels: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(labels)
    if (Array.isArray(parsed)) {
      const result: string[] = []
      for (const item of parsed) {
        if (typeof item === "string") {
          result.push(item)
        } else if (item !== null && typeof item === "object") {
          const labelObj = item as LabelObject
          if (typeof labelObj.name === "string") {
            result.push(labelObj.name)
          }
        }
      }
      return result.filter(Boolean)
    }
  } catch {
    return labels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

// Author type for filters
export interface Author {
  login: string
  avatarUrl: string | null
}

// Extract unique authors from PRs
export const extractAuthors = (prs: readonly GithubPullRequest[]): Author[] => {
  const authorMap = new Map<string, Author>()
  for (const pr of prs) {
    if (pr.authorLogin && !authorMap.has(pr.authorLogin)) {
      authorMap.set(pr.authorLogin, {
        login: pr.authorLogin,
        avatarUrl: pr.authorAvatarUrl ?? null,
      })
    }
  }
  return Array.from(authorMap.values()).sort((a, b) => a.login.localeCompare(b.login))
}

// Extract unique labels from PRs
export const extractLabels = (prs: readonly GithubPullRequest[]): string[] => {
  const labelSet = new Set<string>()
  for (const pr of prs) {
    if (pr.labels) {
      const extractedLabels = parseLabels(pr.labels)
      for (const label of extractedLabels) {
        labelSet.add(label)
      }
    }
  }
  return Array.from(labelSet).sort()
}

// Filter functions
export const filterByStatus = <T extends GithubPullRequest>(
  prs: readonly T[],
  status: PRStatus,
): T[] => {
  if (status === "all") return [...prs]
  if (status === "merged") return prs.filter((pr) => pr.merged === true)
  if (status === "closed") return prs.filter((pr) => pr.state === "closed" && pr.merged !== true)
  if (status === "open") return prs.filter((pr) => pr.state === "open")
  return [...prs]
}

export const filterByDraft = <T extends GithubPullRequest>(prs: T[], draft: PRDraftFilter): T[] => {
  if (draft === "all") return prs
  if (draft === "draft") return prs.filter((pr) => pr.draft === true)
  if (draft === "ready") return prs.filter((pr) => pr.draft !== true)
  return prs
}

export const filterByAuthor = <T extends GithubPullRequest>(
  prs: T[],
  author: string | null,
): T[] => {
  if (!author) return prs
  return prs.filter((pr) => pr.authorLogin === author)
}

export const filterByLabels = <T extends GithubPullRequest>(prs: T[], labels: string[]): T[] => {
  if (labels.length === 0) return prs
  return prs.filter((pr) => {
    if (!pr.labels) return false
    const prLabels = parseLabels(pr.labels)
    return labels.some((label) => prLabels.includes(label))
  })
}

// Sort function
export const sortPRs = <T extends GithubPullRequest>(
  prs: T[],
  sortBy: PRSortField,
  direction: PRSortDirection,
): T[] => {
  const multiplier = direction === "desc" ? -1 : 1

  return [...prs].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "updated":
        comparison = (a.githubUpdatedAt ?? 0) - (b.githubUpdatedAt ?? 0)
        break
      case "created":
        comparison = (a.githubCreatedAt ?? 0) - (b.githubCreatedAt ?? 0)
        break
      case "comments": {
        const aComments = (a.comments ?? 0) + (a.reviewComments ?? 0)
        const bComments = (b.comments ?? 0) + (b.reviewComments ?? 0)
        comparison = aComments - bComments
        break
      }
      case "title":
        comparison = String(a.title ?? "").localeCompare(String(b.title ?? ""))
        break
      case "author":
        comparison = (a.authorLogin ?? "").localeCompare(b.authorLogin ?? "")
        break
      default:
        comparison = 0
    }

    return comparison * multiplier
  })
}

// Combined filter and sort
export const applyFiltersAndSort = <T extends GithubPullRequest>(
  prs: readonly T[],
  filters: PRFilters,
): T[] => {
  let result = filterByStatus(prs, filters.status)
  result = filterByAuthor(result, filters.author)
  result = filterByLabels(result, filters.labels)
  result = filterByDraft(result, filters.draft)
  result = sortPRs(result, filters.sortBy, filters.sortDirection)
  return result
}

// URL search params type (all optional strings/arrays for URL compatibility)
export interface PRFiltersSearchParams {
  status?: PRStatus
  author?: string
  labels?: string[]
  draft?: PRDraftFilter
  sortBy?: PRSortField
  sortDirection?: PRSortDirection
}

// Valid values for validation
const VALID_STATUS: PRStatus[] = ["all", "open", "closed", "merged"]
const VALID_DRAFT: PRDraftFilter[] = ["all", "draft", "ready"]
const VALID_SORT_BY: PRSortField[] = ["updated", "created", "comments", "title", "author"]
const VALID_SORT_DIRECTION: PRSortDirection[] = ["desc", "asc"]

// Parse and validate search params into PRFilters
export const parseFiltersFromSearch = (search: Record<string, unknown>): PRFilters => {
  const status = VALID_STATUS.includes(search.status as PRStatus)
    ? (search.status as PRStatus)
    : DEFAULT_PR_FILTERS.status

  const author =
    typeof search.author === "string" && search.author.length > 0
      ? search.author
      : DEFAULT_PR_FILTERS.author

  const labels = Array.isArray(search.labels)
    ? search.labels.filter((l): l is string => typeof l === "string")
    : DEFAULT_PR_FILTERS.labels

  const draft = VALID_DRAFT.includes(search.draft as PRDraftFilter)
    ? (search.draft as PRDraftFilter)
    : DEFAULT_PR_FILTERS.draft

  const sortBy = VALID_SORT_BY.includes(search.sortBy as PRSortField)
    ? (search.sortBy as PRSortField)
    : DEFAULT_PR_FILTERS.sortBy

  const sortDirection = VALID_SORT_DIRECTION.includes(search.sortDirection as PRSortDirection)
    ? (search.sortDirection as PRSortDirection)
    : DEFAULT_PR_FILTERS.sortDirection

  return { status, author, labels, draft, sortBy, sortDirection }
}

// Convert PRFilters to search params, omitting default values
export const filtersToSearchParams = (filters: PRFilters): PRFiltersSearchParams => {
  const params: PRFiltersSearchParams = {}

  if (filters.status !== DEFAULT_PR_FILTERS.status) {
    params.status = filters.status
  }
  if (filters.author !== DEFAULT_PR_FILTERS.author) {
    params.author = filters.author ?? undefined
  }
  if (filters.labels.length > 0) {
    params.labels = filters.labels
  }
  if (filters.draft !== DEFAULT_PR_FILTERS.draft) {
    params.draft = filters.draft
  }
  if (filters.sortBy !== DEFAULT_PR_FILTERS.sortBy) {
    params.sortBy = filters.sortBy
  }
  if (filters.sortDirection !== DEFAULT_PR_FILTERS.sortDirection) {
    params.sortDirection = filters.sortDirection
  }

  return params
}

// Check if filters have any active (non-default) values
export const hasActiveFilters = (filters: PRFilters): boolean => {
  return (
    filters.status !== DEFAULT_PR_FILTERS.status ||
    filters.author !== DEFAULT_PR_FILTERS.author ||
    filters.labels.length > 0 ||
    filters.draft !== DEFAULT_PR_FILTERS.draft
  )
}
