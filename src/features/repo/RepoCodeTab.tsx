import { Link } from "wouter"
import { FileIcon } from "@primer/octicons-react"
import styles from "./RepoCodeTab.module.css"

interface RepoCodeTabProps {
  fullName: string
}

export function RepoCodeTab({ fullName }: RepoCodeTabProps) {
  return (
    <div className={styles.content}>
      <div className={styles.emptyState}>
        <FileIcon className={styles.emptyIcon} size={48} />
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
