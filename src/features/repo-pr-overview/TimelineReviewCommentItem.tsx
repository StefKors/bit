import { CodeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import type { PullRequestReviewComment } from "./types"
import styles from "./TimelineReviewCommentItem.module.css"

interface TimelineReviewCommentItemProps {
  comment: PullRequestReviewComment
}

export function TimelineReviewCommentItem({ comment }: TimelineReviewCommentItemProps) {
  return (
    <div className={`${styles.timelineItem} ${styles.timelineReviewComment}`}>
      <div className={styles.timelineIcon}>
        <CodeIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineReviewCommentInfo}>
            <AuthorLabel
              login={comment.authorLogin}
              avatarUrl={comment.authorAvatarUrl}
              size={16}
            />
            {comment.path && (
              <code className={styles.timelineFilePath}>
                {comment.path}
                {comment.line != null ? `:${comment.line}` : ""}
              </code>
            )}
          </span>
          <time className={styles.timelineTime}>
            {formatRelativeTime(comment.createdAt || comment.updatedAt)}
          </time>
        </div>
        {comment.body && <Markdown content={comment.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}
