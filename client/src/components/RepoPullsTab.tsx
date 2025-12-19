import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { PRListItem } from "./PRListItem"
import styles from "./RepoPullsTab.module.css"

interface RepoPullsTabProps {
  repoId: string
  fullName: string
}

export function RepoPullsTab({ repoId, fullName }: RepoPullsTabProps) {
  const [prs] = useQuery(queries.pullRequests(repoId))

  if (prs.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <line x1="6" y1="9" x2="6" y2="21" />
          </svg>
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
      <div className={styles.prList}>
        {prs.map((pr) => (
          <PRListItem
            key={pr.id}
            pr={pr}
            repoFullName={fullName}
            isApproved={pr.merged === true}
          />
        ))}
      </div>
    </div>
  )
}
