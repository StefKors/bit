import { AuthorLabel } from "@/components/AuthorLabel"
import { StatusBadge } from "@/components/StatusBadge"
import type { PullRequestCard, PullRequestReview } from "./Types"
import styles from "./PrSidebar.module.css"

interface PrSidebarProps {
  pr: PullRequestCard
}

export function PrSidebar({ pr }: PrSidebarProps) {
  const reviewerLogins = [...new Set(pr.pullRequestReviews.map((r) => r.authorLogin))]
  const latestReviewByAuthor = new Map<string, PullRequestReview>()
  for (const review of pr.pullRequestReviews) {
    const existing = latestReviewByAuthor.get(review.authorLogin)
    if (!existing || (review.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      latestReviewByAuthor.set(review.authorLogin, review)
    }
  }

  return (
    <div className={styles.sidebarContent}>
      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Reviewers</h3>
        {reviewerLogins.length > 0 || pr.requestedReviewers.length > 0 ? (
          <ul className={styles.sidebarList}>
            {reviewerLogins.map((login) => {
              const review = latestReviewByAuthor.get(login)
              return (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} size={16} />
                  {review && (
                    <StatusBadge
                      variant={
                        review.state === "APPROVED"
                          ? "open"
                          : review.state === "CHANGES_REQUESTED"
                            ? "closed"
                            : "draft"
                      }
                    >
                      {review.state.toLowerCase().replaceAll("_", " ")}
                    </StatusBadge>
                  )}
                </li>
              )
            })}
            {pr.requestedReviewers
              .filter((login) => !reviewerLogins.includes(login))
              .map((login) => (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} size={16} />
                  <span className={styles.sidebarMuted}>pending</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Assignees</h3>
        {pr.assignees.length > 0 ? (
          <ul className={styles.sidebarList}>
            {pr.assignees.map((login) => (
              <li key={login} className={styles.sidebarListItem}>
                <AuthorLabel login={login} size={16} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Labels</h3>
        {pr.labels.length > 0 ? (
          <div className={styles.labelList}>
            {pr.labels.map((label) => (
              <span key={label} className={styles.label}>
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Commits</h3>
        <p className={styles.sidebarValue}>{pr.commitsCount}</p>
      </div>
    </div>
  )
}
