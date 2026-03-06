import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { StatusBadge } from "@/components/StatusBadge"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import { getReviewBadgeVariant, getReviewIcon } from "./Utils"
import type { PullRequestReviewWithComments, ReviewCommentThread } from "./Types"
import {
  TimelineItem,
  TimelineItemBody,
  TimelineItemHeader,
  TimelineItemIcon,
} from "./TimelineItemBase"
import styles from "./TimelineReviewItem.module.css"

const NestedCommentThread = ({ thread }: { thread: ReviewCommentThread }) => {
  const { root, replies } = thread
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined

  return (
    <div className={styles.nestedThread}>
      <div className={styles.nestedThreadHeader}>
        <AuthorLabel
          login={root.authorLogin}
          avatarUrl={root.authorAvatarUrl}
          size={13}
          lineHeight="default"
        />
        {root.path && (
          <code className={styles.nestedFilePath}>
            {root.path}
            {root.line != null ? `:${root.line}` : ""}
          </code>
        )}
        <time className={styles.nestedTime}>
          {formatRelativeTime(root.createdAt || root.updatedAt)}
        </time>
      </div>
      {root.body && (
        <Markdown
          content={root.body}
          className={styles.nestedContent}
          defaultLanguage={defaultLanguage}
        />
      )}
      {replies.map((reply) => (
        <div key={reply.id} className={styles.nestedReply}>
          <div className={styles.nestedReplyHeader}>
            <AuthorLabel
              login={reply.authorLogin}
              avatarUrl={reply.authorAvatarUrl}
              size={13}
              lineHeight="default"
            />
            <time className={styles.nestedTime}>
              {formatRelativeTime(reply.createdAt || reply.updatedAt)}
            </time>
          </div>
          {reply.body && (
            <Markdown
              content={reply.body}
              className={styles.nestedReplyBody}
              defaultLanguage={defaultLanguage}
            />
          )}
        </div>
      ))}
    </div>
  )
}

interface TimelineReviewItemProps {
  review: PullRequestReviewWithComments
}

export const TimelineReviewItem = ({ review }: TimelineReviewItemProps) => {
  const stateLabel = review.state.toLowerCase().replaceAll("_", " ")
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
        <TimelineItemBody wide>
          <>
            {review.body && <Markdown content={review.body} className={styles.timelineContent} />}
            {hasNested && (
              <div className={styles.nestedThreads}>
                {review.nestedCommentThreads.map((thread) => (
                  <NestedCommentThread key={thread.root.id} thread={thread} />
                ))}
              </div>
            )}
          </>
        </TimelineItemBody>
      )}
    </TimelineItem>
  )
}
