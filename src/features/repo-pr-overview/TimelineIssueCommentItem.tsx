import { CommentDiscussionIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import type { PullRequestComment } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelineIssueCommentItem.module.css"

interface TimelineIssueCommentItemProps {
  comment: PullRequestComment
}

export const TimelineIssueCommentItem = ({ comment }: TimelineIssueCommentItemProps) => (
  <TimelineItemBase
    icon={<CommentDiscussionIcon size={16} />}
    hideConnector
    header={
      <>
        <AuthorLabel
          login={comment.authorLogin}
          avatarUrl={comment.authorAvatarUrl}
          size={13}
          lineHeight="default"
        />
        <time className={styles.timelineTime}>
          {formatRelativeTime(comment.createdAt || comment.updatedAt)}
        </time>
      </>
    }
  >
    {comment.body && <Markdown content={comment.body} className={styles.timelineContent} />}
  </TimelineItemBase>
)
