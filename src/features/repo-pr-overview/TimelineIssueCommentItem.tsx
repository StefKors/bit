import { CommentDiscussionIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import type { PullRequestComment } from "./types"
import styles from "./TimelineIssueCommentItem.module.css"

interface TimelineIssueCommentItemProps {
  comment: PullRequestComment
}

export function TimelineIssueCommentItem({ comment }: TimelineIssueCommentItemProps) {
  return (
    <div className={`${styles.timelineItem} ${styles.timelineComment}`}>
      <div className={styles.timelineIcon}>
        <CommentDiscussionIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <AuthorLabel login={comment.authorLogin} avatarUrl={comment.authorAvatarUrl} size={16} />
          <time className={styles.timelineTime}>
            {formatRelativeTime(comment.createdAt || comment.updatedAt)}
          </time>
        </div>
        {comment.body && <Markdown content={comment.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}
