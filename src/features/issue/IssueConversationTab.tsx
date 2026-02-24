import { Markdown } from "@/components/Markdown"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubIssueComment = InstaQLEntity<AppSchema, "issueComments">
import styles from "./IssueConversationTab.module.css"
import { Avatar } from "@/components/Avatar"

interface IssueAuthor {
  login: string | null | undefined
  avatarUrl: string | null | undefined
}

interface IssueConversationTabProps {
  issueBody: string | null | undefined
  issueAuthor: IssueAuthor
  issueCreatedAt: Date | number | null | undefined
  comments: readonly GithubIssueComment[]
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

export const IssueConversationTab = ({
  issueBody,
  issueAuthor,
  issueCreatedAt,
  comments,
  formatTimeAgo,
}: IssueConversationTabProps) => {
  // Sort comments by date
  const sortedComments = [...comments].sort((a, b) => {
    const aTime = a.githubCreatedAt ?? 0
    const bTime = b.githubCreatedAt ?? 0
    return aTime - bTime
  })

  return (
    <div className={styles.timeline}>
      {/* Issue Body as first item */}
      {issueBody && (
        <TimelineItemComponent
          avatarUrl={issueAuthor.avatarUrl}
          authorLogin={issueAuthor.login}
          headerContent={
            <span className={styles.timelineTime}>
              opened this issue {formatTimeAgo(issueCreatedAt)}
            </span>
          }
          body={issueBody}
        />
      )}

      {/* Comments */}
      {sortedComments.map((comment) => (
        <TimelineItemComponent
          key={comment.id}
          avatarUrl={comment.authorAvatarUrl}
          authorLogin={comment.authorLogin}
          headerContent={
            <span className={styles.timelineTime}>
              commented {formatTimeAgo(comment.githubCreatedAt)}
            </span>
          }
          body={comment.body}
        />
      ))}

      {!issueBody && sortedComments.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No comments yet. Comments sync automatically when you open this issue.
          </p>
        </div>
      )}
    </div>
  )
}

interface TimelineItemComponentProps {
  avatarUrl: string | null | undefined
  authorLogin: string | null | undefined
  headerContent: React.ReactNode
  body: string | null | undefined
}

const TimelineItemComponent = ({
  avatarUrl,
  authorLogin,
  headerContent,
  body,
}: TimelineItemComponentProps) => {
  return (
    <div className={styles.timelineItem}>
      <Avatar src={avatarUrl} name={authorLogin} size={40} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{authorLogin}</span>
          {headerContent}
        </div>
        {body && (
          <div className={styles.timelineBody}>
            <Markdown content={body} />
          </div>
        )}
      </div>
    </div>
  )
}
