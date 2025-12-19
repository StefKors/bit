import { Link } from "wouter"
import styles from "./RepoCodeTab.module.css"

interface RepoCodeTabProps {
  fullName: string
}

export function RepoCodeTab({ fullName }: RepoCodeTabProps) {
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <h3 className={styles.emptyTitle}>Repository Overview</h3>
        <p className={styles.emptyText}>
          View{" "}
          <Link href={`/${fullName}/pulls`} className={styles.link}>
            Pull Requests
          </Link>{" "}
          to see code changes.
        </p>
      </div>
    </div>
  )
}
