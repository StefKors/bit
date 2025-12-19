import { Link } from "wouter"
import type { Row } from "@rocicorp/zero"
import styles from "./PRListItem.module.css"

type PullRequest = Row["githubPullRequest"]

interface PRListItemProps {
  pr: PullRequest
  repoFullName: string
  isApproved?: boolean
}

// Status indicator component for CI/check status
function StatusDot({
  status,
}: {
  status: "success" | "failure" | "pending" | "warning"
}) {
  const colors = {
    success: "#3fb950",
    failure: "#f85149",
    pending: "#d29922",
    warning: "#d29922",
  }

  return (
    <span
      className={styles.statusDot}
      style={{ backgroundColor: colors[status] }}
      title={status}
    />
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
          {pr.authorLogin && (
            <span className={styles.authorName}>{pr.authorLogin}</span>
          )}
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
            <svg
              className={styles.commentIcon}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.75.75 0 01.53-.22h4.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H2.75z" />
            </svg>
            {totalComments}
          </div>
        )}

        {/* Approved indicator */}
        {isApproved && (
          <span className={styles.approvedBadge} title="Approved">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
            </svg>
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
