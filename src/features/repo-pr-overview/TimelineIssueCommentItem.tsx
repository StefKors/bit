import { CommentDiscussionIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import type { PullRequestComment } from "./Types"
import {
  TimelineItem,
  TimelineItemBody,
  TimelineItemHeader,
  TimelineItemIcon,
} from "./TimelineItemBase"
import styles from "./TimelineIssueCommentItem.module.css"

interface TimelineIssueCommentItemProps {
  comment: PullRequestComment
}

export const TimelineIssueCommentItem = ({ comment }: TimelineIssueCommentItemProps) => (
  <TimelineItem>
    <TimelineItemIcon>
      <CommentDiscussionIcon size={12} />
    </TimelineItemIcon>
    <TimelineItemHeader>
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
    </TimelineItemHeader>
    {comment.body && (
      <TimelineItemBody>
        <Markdown content={comment.body} className={styles.timelineContent} />
      </TimelineItemBody>
    )}
  </TimelineItem>
)
