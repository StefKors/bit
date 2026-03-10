import { formatRelativeTime, formatReviewState } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { StatusBadge } from "@/components/StatusBadge"
import { getReviewBadgeVariant, getReviewIcon } from "./Utils"
import type { PullRequestReaction, PullRequestReviewWithComments } from "./Types"
import {
  TimelineItem,
  TimelineItemBody,
  TimelineItemHeader,
  TimelineItemIcon,
} from "./TimelineItemBase"
import styles from "./TimelineReviewItem.module.css"
import { TimelineReviewNestedCommentThread } from "./TimelineReviewNestedCommentThread"

interface TimelineReviewItemProps {
  review: PullRequestReviewWithComments
  reactions?: PullRequestReaction[]
}

export const TimelineReviewItem = ({ review, reactions = [] }: TimelineReviewItemProps) => {
  const stateLabel = formatReviewState(review.state)
  const hasBody = Boolean(review.body)
  const hasNested = review.nestedCommentThreads.length > 0
  const hasContent = hasBody || hasNested

  return (
    <TimelineItem>
      <TimelineItemIcon>{getReviewIcon(review.state)}</TimelineItemIcon>
      <TimelineItemHeader>
        <>
          <span className={styles.timelineReviewInfo}>
            <AuthorLabel
              login={review.authorLogin}
              avatarUrl={review.authorAvatarUrl}
              size={13}
              lineHeight="default"
            />
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
      </TimelineItemHeader>
      {hasContent && (
        <TimelineItemBody wide={true}>
          <>
            {review.body && <Markdown content={review.body} className={styles.timelineContent} />}
            {hasNested && (
              <div className={styles.nestedThreads}>
                {review.nestedCommentThreads.map((thread) => (
                  <TimelineReviewNestedCommentThread
                    key={thread.root.id}
                    thread={thread}
                    reactions={reactions}
                  />
                ))}
              </div>
            )}
          </>
        </TimelineItemBody>
      )}
    </TimelineItem>
  )
}
