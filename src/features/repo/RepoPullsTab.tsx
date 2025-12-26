import { useState, useMemo } from "react"
import type { Row } from "@rocicorp/zero"
import { useQuery } from "@rocicorp/zero/react"
import { GitPullRequestIcon } from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { PRListItem } from "@/features/pr/PRListItem"
import {
  PRFiltersBar,
  type PRFilters,
  type PRStatus,
  type PRDraftFilter,
  type PRSortField,
  type PRSortDirection,
} from "@/features/pr/PRFiltersBar"
import styles from "./RepoPullsTab.module.css"

type PullRequest = Row["githubPullRequest"]

interface RepoPullsTabProps {
  repoId: string
  fullName: string
}

const DEFAULT_FILTERS: PRFilters = {
  status: "all",
  author: null,
  labels: [],
  draft: "all",
  sortBy: "updated",
  sortDirection: "desc",
}

export function RepoPullsTab({ repoId, fullName }: RepoPullsTabProps) {
  const [prs] = useQuery(queries.pullRequests(repoId))
  const [filters, setFilters] = useState<PRFilters>(DEFAULT_FILTERS)

  // Extract unique authors from PRs
  const authors = useMemo(() => {
    const authorSet = new Set<string>()
    for (const pr of prs) {
      if (pr.authorLogin) {
        authorSet.add(pr.authorLogin)
      }
    }
    return Array.from(authorSet).sort()
  }, [prs])

  // Extract unique labels from PRs
  const labels = useMemo(() => {
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
  }, [prs])

  // Apply filters and sorting
  const filteredPrs = useMemo(() => {
    let result = [...prs]

    // Filter by status
    result = filterByStatus(result, filters.status)

    // Filter by author
    if (filters.author) {
      result = result.filter((pr) => pr.authorLogin === filters.author)
    }

    // Filter by labels
    if (filters.labels.length > 0) {
      result = result.filter((pr) => {
        if (!pr.labels) return false
        const prLabels = parseLabels(pr.labels)
        return filters.labels.some((label) => prLabels.includes(label))
      })
    }

    // Filter by draft status
    result = filterByDraft(result, filters.draft)

    // Sort
    result = sortPRs(result, filters.sortBy, filters.sortDirection)

    return result
  }, [prs, filters])

  if (prs.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No pull requests</h3>
          <p className={styles.emptyText}>
            No pull requests have been synced yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.content}>
      <PRFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        authors={authors}
        labels={labels}
      />
      {filteredPrs.length === 0 ? (
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No matching pull requests</h3>
          <p className={styles.emptyText}>
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <div className={styles.prList}>
          {filteredPrs.map((pr) => (
            <PRListItem
              key={pr.id}
              pr={pr}
              repoFullName={fullName}
              isApproved={pr.merged === true}
            />
          ))}
        </div>
      )}
      {filteredPrs.length > 0 && (
        <div className={styles.resultsCount}>
          Showing {filteredPrs.length} of {prs.length} pull requests
        </div>
      )}
    </div>
  )
}

// Helper functions for filtering and sorting

const filterByStatus = <T extends PullRequest>(prs: T[], status: PRStatus): T[] => {
  if (status === "all") return prs
  if (status === "merged") return prs.filter((pr) => pr.merged === true)
  if (status === "closed") return prs.filter((pr) => pr.state === "closed" && pr.merged !== true)
  if (status === "open") return prs.filter((pr) => pr.state === "open")
  return prs
}

const filterByDraft = <T extends PullRequest>(prs: T[], draft: PRDraftFilter): T[] => {
  if (draft === "all") return prs
  if (draft === "draft") return prs.filter((pr) => pr.draft === true)
  if (draft === "ready") return prs.filter((pr) => pr.draft !== true)
  return prs
}

interface LabelObject {
  name?: string
}

const parseLabels = (labels: string): string[] => {
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

const sortPRs = <T extends PullRequest>(prs: T[], sortBy: PRSortField, direction: PRSortDirection): T[] => {
  const multiplier = direction === "desc" ? -1 : 1

  return prs.sort((a, b) => {
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
