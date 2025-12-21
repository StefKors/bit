import { Link } from "wouter"
import type { Row } from "@rocicorp/zero"
import { CommentIcon, CheckIcon } from "@primer/octicons-react"
import styles from "./PRListItem.module.css"

type PullRequest = Row["githubPullRequest"]

interface PRListItemProps {
  pr: PullRequest
  repoFullName: string
  isApproved?: boolean
}

// Status indicator component for CI/check status
function StatusDot({ status }: { status: "success" | "failure" | "pending" | "warning" }) {
  const colors = {
    success: "#3fb950",
    failure: "#f85149",
    pending: "#d29922",
    warning: "#d29922",
  }

  return (
    <span className={styles.statusDot} style={{ backgroundColor: colors[status] }} title={status} />
  )
}

// Generate mock statuses based on PR state for demo purposes
function getStatusIndicators(pr: {
  state: string
  merged?: boolean | null
  draft?: boolean | null
}) {
  if (pr.draft) {
    return [{ status: "pending" as const }]
  }
  if (pr.merged) {
    return [
      { status: "success" as const },
      { status: "success" as const },
      { status: "success" as const },
    ]
  }
  if (pr.state === "closed") {
    return [{ status: "failure" as const }]
  }
  // Open PRs - show varying statuses
  return [{ status: "success" as const }, { status: "success" as const }]
}

function formatDate(date: Date | number | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

export function PRListItem({ pr, repoFullName, isApproved }: PRListItemProps) {
  const totalComments = (pr.comments ?? 0) + (pr.reviewComments ?? 0)
  const statusIndicators = getStatusIndicators(pr)

  return (
    <Link href={`/${repoFullName}/pull/${pr.number}`} className={styles.prItem}>
      {/* Left side content */}
      <div className={styles.prContent}>
        <h3 className={styles.prTitle}>
          {pr.draft && <span className={styles.draftBadge}>Draft</span>}
          <span className={styles.prTitleText}>{pr.title}</span>
        </h3>

        <div className={styles.prMeta}>
          {pr.authorAvatarUrl && (
            <img
              src={pr.authorAvatarUrl}
              alt={pr.authorLogin || "Author"}
              className={styles.authorAvatar}
            />
          )}
          {pr.authorLogin && <span className={styles.authorName}>{pr.authorLogin}</span>}
          <span className={styles.prPath}>
            {repoFullName}/{pr.number}
          </span>
        </div>
      </div>

      {/* Right side actions */}
      <div className={styles.prActions}>
        {/* Comment count */}
        {totalComments > 0 && (
          <div className={styles.commentCount}>
            <CommentIcon className={styles.commentIcon} size={16} />
            {totalComments}
          </div>
        )}

        {/* Approved indicator */}
        {isApproved && (
          <span className={styles.approvedBadge} title="Approved">
            <CheckIcon size={12} />
          </span>
        )}

        {/* Status indicators (CI jobs) */}
        <div className={styles.statusIndicators}>
          {statusIndicators.map((indicator, index) => (
            <StatusDot key={index} status={indicator.status} />
          ))}
        </div>

        {/* Date */}
        <span className={styles.prDate}>
          {formatDate(pr.githubUpdatedAt || pr.githubCreatedAt)}
        </span>
      </div>
    </Link>
  )
}
