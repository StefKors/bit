import { useState } from "react"
import { CodeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { getLanguageFromFilePath } from "@/lib/Markdown"
import type { PullRequestReaction, ReviewCommentThread, PullRequestReviewComment } from "./Types"
import { TimelineReactions } from "./TimelineReactions"
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
  reactions?: PullRequestReaction[]
}

const ReplyItem = ({
  comment,
  defaultLanguage,
  reactions,
}: {
  comment: PullRequestReviewComment
  defaultLanguage: string | undefined
  reactions: PullRequestReaction[]
}) => (
  <div className={styles.reply}>
    <div className={styles.replyHeader}>
      <AuthorLabel
        login={comment.authorLogin}
        avatarUrl={comment.authorAvatarUrl}
        size={13}
        lineHeight="default"
      />
      {comment.updatedAt > comment.createdAt && <span className={styles.editedLabel}>edited</span>}
      <TimelineItemTime>
        {formatRelativeTime(comment.createdAt || comment.updatedAt)}
      </TimelineItemTime>
    </div>
    {comment.body && (
      <TimelineItemContent>
        <Markdown content={comment.body} defaultLanguage={defaultLanguage} />
        <TimelineReactions reactions={reactions} />
      </TimelineItemContent>
    )}
  </div>
)

export const TimelineReviewCommentItem = ({
  thread,
  reactions = [],
}: TimelineReviewCommentItemProps) => {
  const { root, replies, isResolved, isCollapsed } = thread
  const [isOpen, setIsOpen] = useState(!(isResolved || isCollapsed))
  const defaultLanguage = getLanguageFromFilePath(root.path) ?? undefined
  const hasReplies = replies.length > 0
  const shouldCollapse = !isOpen

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
            {root.updatedAt > root.createdAt && <span className={styles.editedLabel}>edited</span>}
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
            <button
              type="button"
              className={styles.collapsedNoticeButton}
              onClick={() => {
                setIsOpen(true)
              }}
            >
              {isResolved ? "Resolved thread" : "Collapsed thread"}
              {hasReplies ? ` (${replies.length} repl${replies.length === 1 ? "y" : "ies"})` : ""}
              <span className={styles.collapsedNoticeAction}>Show</span>
            </button>
          ) : (
            <>
              {root.body && (
                <TimelineItemContent>
                  <Markdown content={root.body} defaultLanguage={defaultLanguage} />
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
              {hasReplies && (
                <div className={styles.replies}>
                  {replies.map((reply) => (
                    <ReplyItem
                      key={reply.id}
                      comment={reply}
                      defaultLanguage={defaultLanguage}
                      reactions={reactions.filter(
                        (reaction) =>
                          reaction.targetType === "pull_request_review_comment" &&
                          reaction.targetGithubId === reply.githubId &&
                          reaction.count > 0,
                      )}
                    />
                  ))}
                </div>
              )}
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
        </div>
      </TimelineItemBody>
    </TimelineItem>
  )
}
