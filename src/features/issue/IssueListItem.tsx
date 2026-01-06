import { Link } from "@tanstack/react-router"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"
import { CommentIcon, IssueOpenedIcon, IssueClosedIcon, SkipIcon } from "@primer/octicons-react"
import styles from "./IssueListItem.module.css"
import { Avatar } from "@/components/Avatar"
import { parseLabels } from "@/lib/issue-filters"

type Issue = InstaQLEntity<AppSchema, "issues">

interface IssueListItemProps {
  issue: Issue
  repoFullName: string
}

const formatDate = (date: Date | number | null | undefined): string => {
  if (!date) return ""
  const d = typeof date === "number" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  // Check if same day
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) {
    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    return `${diffHours}h ago`
  }

  // Check if yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return "yesterday"
  }

  // Check if same year
  const isSameYear = d.getFullYear() === now.getFullYear()

  if (isSameYear) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type IssueStatus = "open" | "closed" | "not_planned"

const getIssueStatus = (issue: { state: string; stateReason?: string | null }): IssueStatus => {
  if (issue.state === "closed") {
    if (issue.stateReason === "not_planned") return "not_planned"
    return "closed"
  }
  return "open"
}

const StatusIcon = ({ status }: { status: IssueStatus }) => {
  switch (status) {
    case "closed":
      return <IssueClosedIcon size={16} className={`${styles.statusIcon} ${styles.statusClosed}`} />
    case "not_planned":
      return <SkipIcon size={16} className={`${styles.statusIcon} ${styles.statusNotPlanned}`} />
    default:
      return <IssueOpenedIcon size={16} className={`${styles.statusIcon} ${styles.statusOpen}`} />
  }
}

export const IssueListItem = ({ issue, repoFullName }: IssueListItemProps) => {
  const issueStatus = getIssueStatus(issue)
  const labels = issue.labels ? parseLabels(issue.labels) : []

  return (
    <Link
      to="/$owner/$repo/issues/$number"
      params={{
        owner: repoFullName.split("/")[0],
        repo: repoFullName.split("/")[1],
        number: String(issue.number),
      }}
      className={styles.issueItem}
    >
      {/* Status icon */}
      <StatusIcon status={issueStatus} />

      {/* Left side content */}
      <div className={styles.issueContent}>
        <h3 className={styles.issueTitle}>
          <span className={styles.issueTitleText}>{issue.title}</span>
        </h3>

        <div className={styles.issueMeta}>
          <Avatar src={issue.authorAvatarUrl} name={issue.authorLogin} size={16} />
          {issue.authorLogin && <span className={styles.authorName}>{issue.authorLogin}</span>}
          <span className={styles.issuePath}>
            {repoFullName}#{issue.number}
          </span>
        </div>
      </div>

      {/* Right side actions */}
      <div className={styles.issueActions}>
        {/* Labels (show first 2) */}
        {labels.slice(0, 2).map((label) => (
          <span key={label} className={styles.labelBadge}>
            {label}
          </span>
        ))}

        {/* Comment count */}
        {Boolean(issue.comments) && (issue.comments ?? 0) > 0 && (
          <div className={styles.commentCount}>
            <CommentIcon className={styles.commentIcon} size={16} />
            {issue.comments}
          </div>
        )}

        {/* Date */}
        <span className={styles.issueDate}>
          {formatDate(issue.githubUpdatedAt || issue.githubCreatedAt)}
        </span>
      </div>
    </Link>
  )
}
