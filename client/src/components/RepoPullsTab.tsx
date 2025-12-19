import { useQuery } from "@rocicorp/zero/react"
import { GitPullRequestIcon } from "@primer/octicons-react"
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
