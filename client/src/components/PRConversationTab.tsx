import { Markdown } from "./Markdown"
import styles from "./PRConversationTab.module.css"

export interface TimelineItem {
  type: "comment" | "review"
  id: string
  authorLogin: string | null
  authorAvatarUrl: string | null
  body: string | null
  createdAt: Date | null
  reviewState?: string
}

interface PRAuthor {
  login: string | null
  avatarUrl: string | null
}

interface PRConversationTabProps {
  prBody: string | null
  prAuthor: PRAuthor
  prCreatedAt: Date | number | null
  timelineItems: TimelineItem[]
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

export function PRConversationTab({
  prBody,
  prAuthor,
  prCreatedAt,
  timelineItems,
  formatTimeAgo,
}: PRConversationTabProps) {
  return (
    <div className={styles.timeline}>
      {/* PR Body as first item */}
      {prBody && (
        <TimelineItemComponent
          avatarUrl={prAuthor.avatarUrl}
          authorLogin={prAuthor.login}
          headerContent={
            <span className={styles.timelineTime}>
              opened this pull request {formatTimeAgo(prCreatedAt)}
            </span>
          }
          body={prBody}
        />
      )}

      {/* Timeline items */}
      {timelineItems.map((item) => (
        <TimelineItemComponent
          key={item.id}
          avatarUrl={item.authorAvatarUrl}
          authorLogin={item.authorLogin}
          headerContent={
            <>
              {item.type === "review" && item.reviewState && (
                <ReviewStateBadge state={item.reviewState} />
              )}
              <span className={styles.timelineTime}>
                {formatTimeAgo(item.createdAt)}
              </span>
            </>
          }
          body={item.body}
        />
      ))}

      {!prBody && timelineItems.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No comments yet. Click "Sync Details" to fetch the latest.
          </p>
        </div>
      )}
    </div>
  )
}

interface TimelineItemComponentProps {
  avatarUrl: string | null
  authorLogin: string | null
  headerContent: React.ReactNode
  body: string | null
}

function TimelineItemComponent({
  avatarUrl,
  authorLogin,
  headerContent,
  body,
}: TimelineItemComponentProps) {
  return (
    <div className={styles.timelineItem}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={authorLogin || "Author"}
          className={styles.timelineAvatar}
        />
      ) : (
        <div className={styles.timelineAvatarPlaceholder} />
      )}
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

function ReviewStateBadge({ state }: { state: string }) {
  const getClassName = () => {
    switch (state) {
      case "APPROVED":
        return styles.reviewApproved
      case "CHANGES_REQUESTED":
        return styles.reviewChangesRequested
      default:
        return styles.reviewCommented
    }
  }

  const getLabel = () => {
    switch (state) {
      case "APPROVED":
        return "✓ Approved"
      case "CHANGES_REQUESTED":
        return "✗ Changes requested"
      case "COMMENTED":
        return "Reviewed"
      default:
        return state
    }
  }

  return (
    <span className={`${styles.reviewState} ${getClassName()}`}>
      {getLabel()}
    </span>
  )
}
