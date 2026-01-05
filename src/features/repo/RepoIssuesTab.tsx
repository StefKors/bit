import { useState, useMemo } from "react"
import { IssueOpenedIcon } from "@primer/octicons-react"
import type { GithubIssue } from "@/db/schema"
import { IssueListItem } from "@/features/issue/IssueListItem"
import { IssueFiltersBar } from "@/features/issue/IssueFiltersBar"
import {
  type IssueFilters,
  DEFAULT_ISSUE_FILTERS,
  extractAuthors,
  extractLabels,
  applyFiltersAndSort,
} from "@/lib/issue-filters"
import styles from "./RepoIssuesTab.module.css"

interface RepoIssuesTabProps {
  issues: readonly GithubIssue[]
  fullName: string
}

export const RepoIssuesTab = ({ issues, fullName }: RepoIssuesTabProps) => {
  const [filters, setFilters] = useState<IssueFilters>(DEFAULT_ISSUE_FILTERS)

  // Compute derived data
  const authors = useMemo(() => extractAuthors(issues), [issues])
  const labels = useMemo(() => extractLabels(issues), [issues])
  const filteredIssues = useMemo(() => applyFiltersAndSort(issues, filters), [issues, filters])

  const hasActiveFilters =
    filters.status !== "all" || filters.author !== null || filters.labels.length > 0

  if (issues.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <IssueOpenedIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No issues</h3>
          <p className={styles.emptyText}>No issues have been synced yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.content}>
      <IssueFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        authors={authors}
        labels={labels}
        hasActiveFilters={hasActiveFilters}
      />
      {filteredIssues.length === 0 ? (
        <div className={styles.emptyState}>
          <IssueOpenedIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No matching issues</h3>
          <p className={styles.emptyText}>
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <div className={styles.issueList}>
          {filteredIssues.map((issue) => (
            <IssueListItem key={issue.id} issue={issue} repoFullName={fullName} />
          ))}
        </div>
      )}
      {filteredIssues.length > 0 && (
        <div className={styles.resultsCount}>
          Showing {filteredIssues.length} of {issues.length} issues
        </div>
      )}
    </div>
  )
}
