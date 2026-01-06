import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubIssue = InstaQLEntity<AppSchema, "issues">

// Filter types
export type IssueStatus = "all" | "open" | "closed"
export type IssueSortField = "updated" | "created" | "comments" | "title" | "author"
export type IssueSortDirection = "desc" | "asc"

export interface IssueFilters {
  status: IssueStatus
  author: string | null
  labels: string[]
  sortBy: IssueSortField
  sortDirection: IssueSortDirection
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  status: "all",
  author: null,
  labels: [],
  sortBy: "updated",
  sortDirection: "desc",
}

// Filter option definitions
export const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
]

export const SORT_OPTIONS: { value: IssueSortField; label: string }[] = [
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

// Extract unique authors from issues
export const extractAuthors = (issues: readonly GithubIssue[]): Author[] => {
  const authorMap = new Map<string, Author>()
  for (const issue of issues) {
    if (issue.authorLogin && !authorMap.has(issue.authorLogin)) {
      authorMap.set(issue.authorLogin, {
        login: issue.authorLogin,
        avatarUrl: issue.authorAvatarUrl ?? null,
      })
    }
  }
  return Array.from(authorMap.values()).sort((a, b) => a.login.localeCompare(b.login))
}

// Extract unique labels from issues
export const extractLabels = (issues: readonly GithubIssue[]): string[] => {
  const labelSet = new Set<string>()
  for (const issue of issues) {
    if (issue.labels) {
      const extractedLabels = parseLabels(issue.labels)
      for (const label of extractedLabels) {
        labelSet.add(label)
      }
    }
  }
  return Array.from(labelSet).sort()
}

// Filter functions
export const filterByStatus = <T extends GithubIssue>(
  issues: readonly T[],
  status: IssueStatus,
): T[] => {
  if (status === "all") return [...issues]
  if (status === "closed") return issues.filter((issue) => issue.state === "closed")
  if (status === "open") return issues.filter((issue) => issue.state === "open")
  return [...issues]
}

export const filterByAuthor = <T extends GithubIssue>(issues: T[], author: string | null): T[] => {
  if (!author) return issues
  return issues.filter((issue) => issue.authorLogin === author)
}

export const filterByLabels = <T extends GithubIssue>(issues: T[], labels: string[]): T[] => {
  if (labels.length === 0) return issues
  return issues.filter((issue) => {
    if (!issue.labels) return false
    const issueLabels = parseLabels(issue.labels)
    return labels.some((label) => issueLabels.includes(label))
  })
}

// Sort function
export const sortIssues = <T extends GithubIssue>(
  issues: T[],
  sortBy: IssueSortField,
  direction: IssueSortDirection,
): T[] => {
  const multiplier = direction === "desc" ? -1 : 1

  return [...issues].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "updated":
        comparison = (a.githubUpdatedAt ?? 0) - (b.githubUpdatedAt ?? 0)
        break
      case "created":
        comparison = (a.githubCreatedAt ?? 0) - (b.githubCreatedAt ?? 0)
        break
      case "comments":
        comparison = (a.comments ?? 0) - (b.comments ?? 0)
        break
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
export const applyFiltersAndSort = <T extends GithubIssue>(
  issues: readonly T[],
  filters: IssueFilters,
): T[] => {
  let result = filterByStatus(issues, filters.status)
  result = filterByAuthor(result, filters.author)
  result = filterByLabels(result, filters.labels)
  result = sortIssues(result, filters.sortBy, filters.sortDirection)
  return result
}
