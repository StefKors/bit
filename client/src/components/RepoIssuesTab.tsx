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
        <svg
          className={styles.emptyIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3 className={styles.emptyTitle}>Issues</h3>
        <p className={styles.emptyText}>Issues syncing coming soon.</p>
      </div>
    </div>
  )
}
