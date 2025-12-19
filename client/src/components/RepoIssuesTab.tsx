import { IssueOpenedIcon } from "@primer/octicons-react"
import styles from "./RepoIssuesTab.module.css"

interface RepoIssuesTabProps {
  repoId: string
  fullName: string
}

export function RepoIssuesTab({
  repoId: _repoId,
  fullName: _fullName,
}: RepoIssuesTabProps) {
  return (
    <div className={styles.content}>
      <div className={styles.emptyState}>
        <IssueOpenedIcon className={styles.emptyIcon} size={48} />
        <h3 className={styles.emptyTitle}>Issues</h3>
        <p className={styles.emptyText}>Issues syncing coming soon.</p>
      </div>
    </div>
  )
}
