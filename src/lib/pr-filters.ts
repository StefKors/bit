import type { GithubPullRequest } from "@/db/schema"

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
  status: "all",
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
    return labels.split(",").map((s) => s.trim()).filter(Boolean)
  }
  return []
}

// Extract unique authors from PRs
export const extractAuthors = (prs: readonly GithubPullRequest[]): string[] => {
  const authorSet = new Set<string>()
  for (const pr of prs) {
    if (pr.authorLogin) {
      authorSet.add(pr.authorLogin)
    }
  }
  return Array.from(authorSet).sort()
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
export const filterByStatus = <T extends GithubPullRequest>(prs: readonly T[], status: PRStatus): T[] => {
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

export const filterByAuthor = <T extends GithubPullRequest>(prs: T[], author: string | null): T[] => {
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
export const sortPRs = <T extends GithubPullRequest>(prs: T[], sortBy: PRSortField, direction: PRSortDirection): T[] => {
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
        comparison = a.title.localeCompare(b.title)
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
