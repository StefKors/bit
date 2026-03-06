import { CodeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { ReviewCommentThread, PullRequestReviewComment } from "./Types"
import {
  TimelineItem,
  TimelineItemBody,
  TimelineItemContent,
  TimelineItemHeader,
  TimelineItemIcon,
  TimelineItemTime,
} from "./TimelineItemBase"
import styles from "./TimelineReviewCommentItem.module.css"

interface TimelineReviewCommentItemProps {
  thread: ReviewCommentThread
}

const ReplyItem = ({
  comment,
  defaultLanguage,
}: {
  comment: PullRequestReviewComment
  defaultLanguage: string | undefined
}) => (
  <div className={styles.reply}>
    <div className={styles.replyHeader}>
      <AuthorLabel
        login={comment.authorLogin}
        avatarUrl={comment.authorAvatarUrl}
        size={13}
        lineHeight="default"
      />
      <TimelineItemTime>
        {formatRelativeTime(comment.createdAt || comment.updatedAt)}
      </TimelineItemTime>
    </div>
    {comment.body && (
      <TimelineItemContent>
        <Markdown content={comment.body} defaultLanguage={defaultLanguage} />
      </TimelineItemContent>
    )}
  </div>
)

export const TimelineReviewCommentItem = ({ thread }: TimelineReviewCommentItemProps) => {
  const { root, replies, isResolved, isCollapsed } = thread
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined
  const hasReplies = replies.length > 0
  const shouldCollapse = isResolved || isCollapsed

  return (
    <TimelineItem>
      <TimelineItemIcon>
        <CodeIcon size={12} />
      </TimelineItemIcon>
      <TimelineItemHeader>
        <>
          <span className={styles.timelineReviewCommentInfo}>
            <AuthorLabel
              login={root.authorLogin}
              avatarUrl={root.authorAvatarUrl}
              size={13}
              lineHeight="default"
            />
            {root.path && (
              <code className={styles.timelineFilePath}>
                {root.path}
                {root.line != null ? `:${root.line}` : ""}
              </code>
            )}
          </span>
          <TimelineItemTime>
            {formatRelativeTime(root.createdAt || root.updatedAt)}
          </TimelineItemTime>
        </>
      </TimelineItemHeader>
      <TimelineItemBody wide={hasReplies}>
        <div className={styles.threadBody}>
          {shouldCollapse ? (
            <div className={styles.collapsedNotice}>
              {isResolved ? "Resolved thread" : "Collapsed thread"}
              {hasReplies ? ` (${replies.length} repl${replies.length === 1 ? "y" : "ies"})` : ""}
            </div>
          ) : (
            <>
              {root.body && (
                <TimelineItemContent>
                  <Markdown content={root.body} defaultLanguage={defaultLanguage} />
                </TimelineItemContent>
              )}
              {hasReplies && (
                <div className={styles.replies}>
                  {replies.map((reply) => (
                    <ReplyItem key={reply.id} comment={reply} defaultLanguage={defaultLanguage} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </TimelineItemBody>
    </TimelineItem>
  )
}
