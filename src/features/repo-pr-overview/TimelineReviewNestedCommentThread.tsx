import { useState } from "react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { PullRequestReaction, ReviewCommentThread } from "./Types"
import { TimelineItemBody, TimelineItemContent } from "./TimelineItemBase"
import { TimelineReactions } from "./TimelineReactions"
import styles from "./TimelineReviewNestedCommentThread.module.css"

interface TimelineReviewNestedCommentThreadProps {
  thread: ReviewCommentThread
  reactions?: PullRequestReaction[]
}

export const TimelineReviewNestedCommentThread = ({
  thread,
  reactions = [],
}: TimelineReviewNestedCommentThreadProps) => {
  const { root, replies, isResolved, isCollapsed } = thread
  const [isOpen, setIsOpen] = useState(!(isResolved || isCollapsed))
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined
  const shouldCollapse = !isOpen

  return (
    <div className={styles.nestedThread}>
      <div className={styles.nestedThreadHeader}>
        <AuthorLabel
          login={root.authorLogin}
          avatarUrl={root.authorAvatarUrl}
          size={13}
          lineHeight="default"
        />
        {root.updatedAt > root.createdAt && <span className={styles.editedLabel}>edited</span>}
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
          <button
            type="button"
            className={styles.collapsedNoticeButton}
            onClick={() => {
              setIsOpen(true)
            }}
          >
            {isResolved ? "Resolved thread" : "Collapsed thread"}
            {replies.length > 0
              ? ` (${replies.length} repl${replies.length === 1 ? "y" : "ies"})`
              : ""}
            <span className={styles.collapsedNoticeAction}>Show</span>
          </button>
        ) : (
          <>
            {root.body && (
              <TimelineItemContent>
                <Markdown
                  content={root.body}
                  className={styles.nestedContent}
                  defaultLanguage={defaultLanguage}
                />
                <TimelineReactions
                  reactions={reactions.filter(
                    (reaction) =>
                      reaction.targetType === "pull_request_review_comment" &&
                      reaction.targetGithubId === root.githubId &&
                      reaction.count > 0,
                  )}
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
                  {reply.updatedAt > reply.createdAt && (
                    <span className={styles.editedLabel}>edited</span>
                  )}
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
                    <TimelineReactions
                      reactions={reactions.filter(
                        (reaction) =>
                          reaction.targetType === "pull_request_review_comment" &&
                          reaction.targetGithubId === reply.githubId &&
                          reaction.count > 0,
                      )}
                    />
                  </TimelineItemContent>
                )}
              </div>
            ))}
            {(isResolved || isCollapsed) && (
              <button
                type="button"
                className={styles.collapsedNoticeActionInline}
                onClick={() => {
                  setIsOpen(false)
                }}
              >
                Hide thread
              </button>
            )}
          </>
        )}
      </TimelineItemBody>
    </div>
  )
}
