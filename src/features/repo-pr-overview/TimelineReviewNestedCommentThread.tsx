import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { ReviewCommentThread } from "./Types"
import { TimelineItemBody, TimelineItemContent } from "./TimelineItemBase"
import styles from "./TimelineReviewNestedCommentThread.module.css"

interface TimelineReviewNestedCommentThreadProps {
  thread: ReviewCommentThread
}

export const TimelineReviewNestedCommentThread = ({
  thread,
}: TimelineReviewNestedCommentThreadProps) => {
  const { root, replies, isResolved, isCollapsed } = thread
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined
  const shouldCollapse = isResolved || isCollapsed

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
      <TimelineItemBody wide={false}>
        {shouldCollapse ? (
          <div className={styles.collapsedNotice}>
            {isResolved ? "Resolved thread" : "Collapsed thread"}
            {replies.length > 0
              ? ` (${replies.length} repl${replies.length === 1 ? "y" : "ies"})`
              : ""}
          </div>
        ) : (
          <>
            {root.body && (
              <TimelineItemContent>
                <Markdown
                  content={root.body}
                  className={styles.nestedContent}
                  defaultLanguage={defaultLanguage}
                />
              </TimelineItemContent>
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
                  <TimelineItemContent>
                    <Markdown
                      content={reply.body}
                      className={styles.nestedReplyBody}
                      defaultLanguage={defaultLanguage}
                    />
                  </TimelineItemContent>
                )}
              </div>
            ))}
          </>
        )}
      </TimelineItemBody>
    </div>
  )
}
