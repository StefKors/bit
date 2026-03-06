import { AuthorLabel } from "@/components/AuthorLabel"
import { StatusBadge } from "@/components/StatusBadge"
import { formatReviewState } from "@/lib/Format"
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

  const hasReviewers = reviewerLogins.length > 0 || pr.requestedReviewers.length > 0
  const hasAssignees = pr.assignees.length > 0
  const hasLabels = pr.labels.length > 0

  return (
    <div className={styles.sidebarContent}>
      {hasReviewers && (
        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarSectionTitle}>Reviewers</h3>
          <ul className={styles.sidebarList}>
            {reviewerLogins.map((login) => {
              const review = latestReviewByAuthor.get(login)
              return (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} avatarUrl={review?.authorAvatarUrl} />
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
                      {formatReviewState(review.state)}
                    </StatusBadge>
                  )}
                </li>
              )
            })}
            {pr.requestedReviewers
              .filter((login) => !reviewerLogins.includes(login))
              .map((login) => (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} />
                  <span className={styles.sidebarMuted}>Pending</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {hasAssignees && (
        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarSectionTitle}>Assignees</h3>
          <ul className={styles.sidebarList}>
            {pr.assignees.map((login) => (
              <li key={login} className={styles.sidebarListItem}>
                <AuthorLabel login={login} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasLabels && (
        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarSectionTitle}>Labels</h3>
          <div className={styles.labelList}>
            {pr.labels.map((label) => (
              <span key={label} className={styles.label}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
