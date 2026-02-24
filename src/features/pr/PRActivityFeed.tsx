import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubPrEvent = InstaQLEntity<AppSchema, "prEvents">
type GithubPrReview = InstaQLEntity<AppSchema, "prReviews">
type GithubPrComment = InstaQLEntity<AppSchema, "prComments">
type GithubPrCommit = InstaQLEntity<AppSchema, "prCommits">
import { Avatar } from "@/components/Avatar"
import { Markdown } from "@/components/Markdown"
import {
  GitCommitIcon,
  TagIcon,
  PersonIcon,
  EyeIcon,
  GitMergeIcon,
  IssueClosedIcon,
  IssueReopenedIcon,
  RepoForkedIcon,
  PencilIcon,
  LockIcon,
  UnlockIcon,
  MilestoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  CommentIcon,
} from "@primer/octicons-react"
import styles from "./PRActivityFeed.module.css"

interface PRAuthor {
  login: string | null | undefined
  avatarUrl: string | null | undefined
}

interface PRActivityFeedProps {
  prBody: string | null | undefined
  prAuthor: PRAuthor
  prCreatedAt: Date | number | null | undefined
  events: readonly GithubPrEvent[]
  commits: readonly GithubPrCommit[]
  reviews: readonly GithubPrReview[]
  comments: readonly GithubPrComment[]
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

interface TimelineItem {
  type: "pr_opened" | "event" | "commit" | "review" | "comment" | "review_comment"
  id: string
  timestamp: number | null | undefined
  data: {
    event?: GithubPrEvent
    commit?: GithubPrCommit
    review?: GithubPrReview
    comment?: GithubPrComment
    prBody?: string | null | undefined
    prAuthor?: PRAuthor
  }
}

export const PRActivityFeed = ({
  prBody,
  prAuthor,
  prCreatedAt,
  events,
  commits,
  reviews,
  comments,
  formatTimeAgo,
}: PRActivityFeedProps) => {
  // Build unified timeline
  const timelineItems: TimelineItem[] = []

  // Add PR opened as first item
  const prCreatedTime =
    typeof prCreatedAt === "number" ? prCreatedAt : (prCreatedAt?.getTime() ?? 0)
  timelineItems.push({
    type: "pr_opened",
    id: "pr_opened",
    timestamp: prCreatedTime,
    data: { prBody, prAuthor },
  })

  // Add events
  for (const event of events) {
    timelineItems.push({
      type: "event",
      id: event.id,
      timestamp: event.eventCreatedAt,
      data: { event },
    })
  }

  // Add commits (pushes)
  for (const commit of commits) {
    timelineItems.push({
      type: "commit",
      id: commit.id,
      timestamp: commit.committedAt,
      data: { commit },
    })
  }

  // Add reviews
  for (const review of reviews) {
    timelineItems.push({
      type: "review",
      id: review.id,
      timestamp: review.submittedAt,
      data: { review },
    })
  }

  for (const comment of comments) {
    timelineItems.push({
      type: comment.commentType === "review_comment" ? "review_comment" : "comment",
      id: comment.id,
      timestamp: comment.githubCreatedAt,
      data: { comment },
    })
  }

  // Sort by timestamp
  timelineItems.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  if (timelineItems.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          No activity yet. Click "Sync Details" to fetch the latest.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.timeline}>
      {timelineItems.map((item) => (
        <TimelineItemRenderer key={item.id} item={item} formatTimeAgo={formatTimeAgo} />
      ))}
    </div>
  )
}

const TimelineItemRenderer = ({
  item,
  formatTimeAgo,
}: {
  item: TimelineItem
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  switch (item.type) {
    case "pr_opened":
      return (
        <PROpenedItem
          prBody={item.data.prBody}
          prAuthor={item.data.prAuthor!}
          timestamp={item.timestamp}
          formatTimeAgo={formatTimeAgo}
        />
      )
    case "event":
      return <EventItem event={item.data.event!} formatTimeAgo={formatTimeAgo} />
    case "commit":
      return <CommitItem commit={item.data.commit!} formatTimeAgo={formatTimeAgo} />
    case "review":
      return <ReviewItem review={item.data.review!} formatTimeAgo={formatTimeAgo} />
    case "comment":
      return <CommentItem comment={item.data.comment!} formatTimeAgo={formatTimeAgo} />
    case "review_comment":
      return <ReviewCommentItem comment={item.data.comment!} formatTimeAgo={formatTimeAgo} />
    default:
      return null
  }
}

const PROpenedItem = ({
  prBody,
  prAuthor,
  timestamp,
  formatTimeAgo,
}: {
  prBody: string | null | undefined
  prAuthor: PRAuthor
  timestamp: number | null | undefined
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  return (
    <div className={styles.timelineItem}>
      <Avatar src={prAuthor.avatarUrl} name={prAuthor.login} size={40} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{prAuthor.login}</span>
          <span className={styles.timelineAction}>opened this pull request</span>
          <span className={styles.timelineTime}>{formatTimeAgo(timestamp)}</span>
        </div>
        {prBody && (
          <div className={styles.timelineBody}>
            <Markdown content={prBody} />
          </div>
        )}
      </div>
    </div>
  )
}

const EventItem = ({
  event,
  formatTimeAgo,
}: {
  event: GithubPrEvent
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  const { icon, content, colorClass } = getEventDisplay(event)

  // Skip rendering if this is a type we don't want to show
  if (!content) return null

  return (
    <div className={`${styles.eventItem} ${colorClass}`}>
      <div className={styles.eventIcon}>{icon}</div>
      <div className={styles.eventContent}>
        {event.actorLogin && <span className={styles.eventActor}>{event.actorLogin}</span>}
        {content}
        <span className={styles.eventTime}>{formatTimeAgo(event.eventCreatedAt)}</span>
      </div>
    </div>
  )
}

const CommitItem = ({
  commit,
  formatTimeAgo,
}: {
  commit: GithubPrCommit
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  const shortSha = typeof commit.sha === "string" ? commit.sha.substring(0, 7) : ""
  const message = typeof commit.message === "string" ? commit.message : ""
  const firstLine = message.split("\n")[0] ?? ""

  return (
    <div className={`${styles.eventItem} ${styles.eventCommit}`}>
      <div className={styles.eventIcon}>
        <GitCommitIcon size={16} />
      </div>
      <div className={styles.eventContent}>
        {commit.authorLogin && <span className={styles.eventActor}>{commit.authorLogin}</span>}
        <span className={styles.eventText}>
          pushed commit <code className={styles.commitSha}>{shortSha}</code>
          {firstLine && <span className={styles.commitMessage}>{firstLine}</span>}
        </span>
        <span className={styles.eventTime}>{formatTimeAgo(commit.committedAt)}</span>
      </div>
    </div>
  )
}

const getEventDisplay = (
  event: GithubPrEvent,
): { icon: React.ReactNode; content: React.ReactNode; colorClass: string } => {
  switch (event.eventType) {
    case "committed":
      return {
        icon: <GitCommitIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            pushed commit{" "}
            <code className={styles.commitSha}>{event.commitSha?.substring(0, 7)}</code>
            {event.commitMessage && (
              <span className={styles.commitMessage}>{event.commitMessage.split("\n")[0]}</span>
            )}
          </span>
        ),
        colorClass: styles.eventCommit,
      }

    case "labeled":
      return {
        icon: <TagIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            added label{" "}
            <span
              className={styles.label}
              style={{
                backgroundColor: event.labelColor ? `#${event.labelColor}` : undefined,
                color: event.labelColor ? getContrastColor(event.labelColor) : undefined,
              }}
            >
              {event.labelName}
            </span>
          </span>
        ),
        colorClass: styles.eventLabel,
      }

    case "unlabeled":
      return {
        icon: <TagIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            removed label{" "}
            <span
              className={styles.label}
              style={{
                backgroundColor: event.labelColor ? `#${event.labelColor}` : undefined,
                color: event.labelColor ? getContrastColor(event.labelColor) : undefined,
              }}
            >
              {event.labelName}
            </span>
          </span>
        ),
        colorClass: styles.eventLabel,
      }

    case "assigned":
      return {
        icon: <PersonIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            assigned <span className={styles.userMention}>{event.assigneeLogin}</span>
          </span>
        ),
        colorClass: styles.eventAssign,
      }

    case "unassigned":
      return {
        icon: <PersonIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            unassigned <span className={styles.userMention}>{event.assigneeLogin}</span>
          </span>
        ),
        colorClass: styles.eventAssign,
      }

    case "review_requested":
      return {
        icon: <EyeIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            requested review from{" "}
            <span className={styles.userMention}>{event.requestedReviewerLogin}</span>
          </span>
        ),
        colorClass: styles.eventReviewRequest,
      }

    case "review_request_removed":
      return {
        icon: <EyeIcon size={16} />,
        content: (
          <span className={styles.eventText}>
            removed review request from{" "}
            <span className={styles.userMention}>{event.requestedReviewerLogin}</span>
          </span>
        ),
        colorClass: styles.eventReviewRequest,
      }

    case "merged":
      return {
        icon: <GitMergeIcon size={16} />,
        content: <span className={styles.eventText}>merged this pull request</span>,
        colorClass: styles.eventMerged,
      }

    case "closed":
      return {
        icon: <IssueClosedIcon size={16} />,
        content: <span className={styles.eventText}>closed this pull request</span>,
        colorClass: styles.eventClosed,
      }

    case "reopened":
      return {
        icon: <IssueReopenedIcon size={16} />,
        content: <span className={styles.eventText}>reopened this pull request</span>,
        colorClass: styles.eventReopened,
      }

    case "head_ref_force_pushed":
      return {
        icon: <RepoForkedIcon size={16} />,
        content: <span className={styles.eventText}>force-pushed the branch</span>,
        colorClass: styles.eventForcePush,
      }

    case "head_ref_deleted":
      return {
        icon: <RepoForkedIcon size={16} />,
        content: <span className={styles.eventText}>deleted the branch</span>,
        colorClass: styles.eventBranch,
      }

    case "head_ref_restored":
      return {
        icon: <RepoForkedIcon size={16} />,
        content: <span className={styles.eventText}>restored the branch</span>,
        colorClass: styles.eventBranch,
      }

    case "base_ref_changed":
      return {
        icon: <RepoForkedIcon size={16} />,
        content: <span className={styles.eventText}>changed the base branch</span>,
        colorClass: styles.eventBranch,
      }

    case "renamed":
      return {
        icon: <PencilIcon size={16} />,
        content: <span className={styles.eventText}>renamed this pull request</span>,
        colorClass: styles.eventRename,
      }

    case "ready_for_review":
      return {
        icon: <EyeIcon size={16} />,
        content: <span className={styles.eventText}>marked as ready for review</span>,
        colorClass: styles.eventReadyForReview,
      }

    case "convert_to_draft":
      return {
        icon: <PencilIcon size={16} />,
        content: <span className={styles.eventText}>converted to draft</span>,
        colorClass: styles.eventDraft,
      }

    case "milestoned":
      return {
        icon: <MilestoneIcon size={16} />,
        content: <span className={styles.eventText}>added to a milestone</span>,
        colorClass: styles.eventMilestone,
      }

    case "demilestoned":
      return {
        icon: <MilestoneIcon size={16} />,
        content: <span className={styles.eventText}>removed from a milestone</span>,
        colorClass: styles.eventMilestone,
      }

    case "locked":
      return {
        icon: <LockIcon size={16} />,
        content: <span className={styles.eventText}>locked this conversation</span>,
        colorClass: styles.eventLock,
      }

    case "unlocked":
      return {
        icon: <UnlockIcon size={16} />,
        content: <span className={styles.eventText}>unlocked this conversation</span>,
        colorClass: styles.eventLock,
      }

    default:
      // Return empty content for unknown event types to skip rendering
      return {
        icon: null,
        content: null,
        colorClass: "",
      }
  }
}

const ReviewItem = ({
  review,
  formatTimeAgo,
}: {
  review: GithubPrReview
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  return (
    <div className={styles.timelineItem}>
      <Avatar src={review.authorAvatarUrl} name={review.authorLogin} size={40} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{review.authorLogin}</span>
          <ReviewStateBadge state={review.state} />
          <span className={styles.timelineTime}>{formatTimeAgo(review.submittedAt)}</span>
        </div>
        {review.body && (
          <div className={styles.timelineBody}>
            <Markdown content={review.body} />
          </div>
        )}
      </div>
    </div>
  )
}

const ReviewStateBadge = ({ state }: { state: string }) => {
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

  const getIcon = () => {
    switch (state) {
      case "APPROVED":
        return <CheckCircleIcon size={14} />
      case "CHANGES_REQUESTED":
        return <XCircleIcon size={14} />
      default:
        return <CommentIcon size={14} />
    }
  }

  const getLabel = () => {
    switch (state) {
      case "APPROVED":
        return "approved these changes"
      case "CHANGES_REQUESTED":
        return "requested changes"
      case "COMMENTED":
        return "reviewed"
      default:
        return state.toLowerCase()
    }
  }

  return (
    <span className={`${styles.reviewState} ${getClassName()}`}>
      {getIcon()}
      {getLabel()}
    </span>
  )
}

const CommentItem = ({
  comment,
  formatTimeAgo,
}: {
  comment: GithubPrComment
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  return (
    <div className={styles.timelineItem}>
      <Avatar src={comment.authorAvatarUrl} name={comment.authorLogin} size={40} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{comment.authorLogin}</span>
          <span className={styles.timelineAction}>commented</span>
          <span className={styles.timelineTime}>{formatTimeAgo(comment.githubCreatedAt)}</span>
        </div>
        {comment.body && (
          <div className={styles.timelineBody}>
            <Markdown content={comment.body} />
          </div>
        )}
      </div>
    </div>
  )
}

const ReviewCommentItem = ({
  comment,
  formatTimeAgo,
}: {
  comment: GithubPrComment
  formatTimeAgo: (date: Date | number | null | undefined) => string
}) => {
  return (
    <div className={styles.timelineItem}>
      <Avatar src={comment.authorAvatarUrl} name={comment.authorLogin} size={40} />
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{comment.authorLogin}</span>
          <span className={styles.timelineAction}>
            commented on <code className={styles.reviewCommentPath}>{comment.path}</code>
            {comment.line != null && (
              <span className={styles.reviewCommentLine}>:{comment.line}</span>
            )}
          </span>
          <span className={styles.timelineTime}>{formatTimeAgo(comment.githubCreatedAt)}</span>
        </div>
        {comment.diffHunk && <DiffHunkSnippet diffHunk={comment.diffHunk} />}
        {comment.body && (
          <div className={styles.timelineBody}>
            <Markdown content={comment.body} />
          </div>
        )}
      </div>
    </div>
  )
}

const DiffHunkSnippet = ({ diffHunk }: { diffHunk: string }) => {
  const lines = diffHunk.split("\n")
  const lastLines = lines.slice(-4)

  return (
    <div className={styles.diffHunkSnippet}>
      <pre className={styles.diffHunkPre}>
        {lastLines.map((line, i) => {
          let lineClass = styles.diffHunkLine
          if (line.startsWith("+")) lineClass = `${styles.diffHunkLine} ${styles.diffHunkAdd}`
          else if (line.startsWith("-")) lineClass = `${styles.diffHunkLine} ${styles.diffHunkDel}`
          else if (line.startsWith("@@"))
            lineClass = `${styles.diffHunkLine} ${styles.diffHunkMeta}`

          return (
            <code key={i} className={lineClass}>
              {line}
            </code>
          )
        })}
      </pre>
    </div>
  )
}

// Helper function to get contrasting text color for label backgrounds
const getContrastColor = (hexColor: string): string => {
  const r = parseInt(hexColor.substring(0, 2), 16)
  const g = parseInt(hexColor.substring(2, 4), 16)
  const b = parseInt(hexColor.substring(4, 6), 16)
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}
