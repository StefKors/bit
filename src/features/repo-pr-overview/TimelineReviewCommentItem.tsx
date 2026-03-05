import { CodeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { PullRequestReviewComment } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelineReviewCommentItem.module.css"

interface TimelineReviewCommentItemProps {
  comment: PullRequestReviewComment
}

export const TimelineReviewCommentItem = ({ comment }: TimelineReviewCommentItemProps) => (
  <TimelineItemBase
    icon={<CodeIcon size={16} />}
    header={
      <>
        <span className={styles.timelineReviewCommentInfo}>
          <AuthorLabel login={comment.authorLogin} avatarUrl={comment.authorAvatarUrl} size={16} />
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
      </>
    }
  >
    {comment.body && (
      <Markdown
        content={comment.body}
        className={styles.timelineContent}
        defaultLanguage={getLanguageFromFilePath(comment.path)}
      />
    )}
  </TimelineItemBase>
)
