import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { StatusBadge } from "@/components/StatusBadge"
import { getReviewBadgeVariant, getReviewIcon } from "./Utils"
import type { PullRequestReview } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelineReviewItem.module.css"

interface TimelineReviewItemProps {
  review: PullRequestReview
}

export const TimelineReviewItem = ({ review }: TimelineReviewItemProps) => {
  const stateLabel = review.state.toLowerCase().replaceAll("_", " ")

  return (
    <TimelineItemBase
      icon={getReviewIcon(review.state)}
      header={
        <>
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
        </>
      }
    >
      {review.body && <Markdown content={review.body} className={styles.timelineContent} />}
    </TimelineItemBase>
  )
}
