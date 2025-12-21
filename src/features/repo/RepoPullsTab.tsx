import { GitPullRequestIcon } from "@primer/octicons-react"
import { PRListItem } from "@/features/pr/PRListItem"
import type { GithubPullRequest } from "@/db/schema"
import styles from "./RepoPullsTab.module.css"

interface RepoPullsTabProps {
  prs: readonly GithubPullRequest[]
  fullName: string
}

export function RepoPullsTab({ prs, fullName }: RepoPullsTabProps) {

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
