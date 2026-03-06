import { CodeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { ReviewCommentThread, PullRequestReviewComment } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
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
      <time className={styles.replyTime}>
        {formatRelativeTime(comment.createdAt || comment.updatedAt)}
      </time>
    </div>
    {comment.body && (
      <Markdown
        content={comment.body}
        className={styles.replyBody}
        defaultLanguage={defaultLanguage}
      />
    )}
  </div>
)

export const TimelineReviewCommentItem = ({ thread }: TimelineReviewCommentItemProps) => {
  const { root, replies } = thread
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined
  const hasReplies = replies.length > 0

  return (
    <TimelineItemBase
      icon={<CodeIcon size={10} />}
      hideConnector={hasReplies}
      bodyWide={hasReplies}
      header={
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
          <time className={styles.timelineTime}>
            {formatRelativeTime(root.createdAt || root.updatedAt)}
          </time>
        </>
      }
    >
      <div className={styles.threadBody}>
        {root.body && (
          <Markdown
            content={root.body}
            className={styles.timelineContent}
            defaultLanguage={defaultLanguage}
          />
        )}
        {replies.length > 0 && (
          <div className={styles.replies}>
            {replies.map((reply) => (
              <ReplyItem key={reply.id} comment={reply} defaultLanguage={defaultLanguage} />
            ))}
          </div>
        )}
      </div>
    </TimelineItemBase>
  )
}
