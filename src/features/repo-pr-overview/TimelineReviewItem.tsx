import { formatRelativeTime } from "@/lib/format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { StatusBadge } from "@/components/StatusBadge"
import { getReviewBadgeVariant, getReviewIcon } from "./utils"
import type { PullRequestReview } from "./types"
import styles from "./TimelineReviewItem.module.css"

interface TimelineReviewItemProps {
  review: PullRequestReview
}

export function TimelineReviewItem({ review }: TimelineReviewItemProps) {
  const stateLabel = review.state.toLowerCase().replaceAll("_", " ")

  return (
    <div className={`${styles.timelineItem} ${styles.timelineReview}`}>
      <div className={styles.timelineIcon}>{getReviewIcon(review.state)}</div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineReviewInfo}>
            <AuthorLabel login={review.authorLogin} avatarUrl={review.authorAvatarUrl} size={16} />
            <StatusBadge
              variant={getReviewBadgeVariant(review.state)}
              icon={getReviewIcon(review.state)}
            >
              {stateLabel}
            </StatusBadge>
          </span>
          <time className={styles.timelineTime}>
            {formatRelativeTime(review.submittedAt ?? review.updatedAt)}
          </time>
        </div>
        {review.body && <Markdown content={review.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}
