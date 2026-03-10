import { CommentDiscussionIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import type { PullRequestComment, PullRequestReaction } from "./Types"
import { TimelineReactions } from "./TimelineReactions"
import {
  TimelineItem,
  TimelineItemBody,
  TimelineItemHeader,
  TimelineItemIcon,
} from "./TimelineItemBase"
import styles from "./TimelineIssueCommentItem.module.css"

interface TimelineIssueCommentItemProps {
  comment: PullRequestComment
  reactions?: PullRequestReaction[]
}

export const TimelineIssueCommentItem = ({
  comment,
  reactions = [],
}: TimelineIssueCommentItemProps) => {
  const isEdited = comment.updatedAt > comment.createdAt

  return (
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
          {isEdited && <span className={styles.editedLabel}>edited</span>}
          <time className={styles.timelineTime}>
            {formatRelativeTime(comment.createdAt || comment.updatedAt)}
          </time>
        </>
      </TimelineItemHeader>
      {comment.body && (
        <TimelineItemBody>
          <Markdown content={comment.body} className={styles.timelineContent} />
          <TimelineReactions reactions={reactions} />
        </TimelineItemBody>
      )}
    </TimelineItem>
  )
}
