import { useMemo } from "react"
import { GitPullRequestIcon } from "@primer/octicons-react"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubPullRequest = InstaQLEntity<AppSchema, "pullRequests">
import { PRListItem } from "@/features/pr/PRListItem"
import { PRFiltersBar } from "@/features/pr/PRFiltersBar"
import {
  type PRFilters,
  extractAuthors,
  extractLabels,
  applyFiltersAndSort,
  hasActiveFilters as checkActiveFilters,
} from "@/lib/pr-filters"
import styles from "./RepoPullsTab.module.css"

interface RepoPullsTabProps {
  prs: readonly GithubPullRequest[]
  fullName: string
  filters: PRFilters
  onFiltersChange: (filters: PRFilters) => void
}

export const RepoPullsTab = ({ prs, fullName, filters, onFiltersChange }: RepoPullsTabProps) => {
  // Compute derived data
  const authors = useMemo(() => extractAuthors(prs), [prs])
  const labels = useMemo(() => extractLabels(prs), [prs])
  const filteredPrs = useMemo(() => applyFiltersAndSort(prs, filters), [prs, filters])

  const hasActiveFilters = checkActiveFilters(filters)

  if (prs.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No pull requests</h3>
          <p className={styles.emptyText}>No pull requests have been synced yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.content}>
      <PRFiltersBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        authors={authors}
        labels={labels}
        hasActiveFilters={hasActiveFilters}
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
