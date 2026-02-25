import { Link } from "@tanstack/react-router"
import {
  CommentIcon,
  CheckIcon,
  GitPullRequestIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitMergeIcon,
} from "@primer/octicons-react"
import styles from "./PRListItem.module.css"
import { Avatar } from "@/components/Avatar"
import type { PRFiltersSearchParams } from "@/lib/pr-filters"

export interface PullRequestLike {
  number: number
  title: string
  state: string
  draft?: boolean | null
  merged?: boolean | null
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  comments?: number | null
  reviewComments?: number | null
  githubCreatedAt?: Date | number | string | null
  githubUpdatedAt?: Date | number | string | null
  prChecks?: Array<{ status?: string | null; conclusion?: string | null }> | null
}

interface PRListItemProps {
  pr: PullRequestLike
  repoFullName: string
  isApproved?: boolean
  searchParams?: PRFiltersSearchParams
}

type CIStatus = "success" | "failure" | "pending"

// Compact CI status indicator
function StatusDot({ status }: { status: CIStatus }) {
  const colors = {
    success: "#3fb950",
    failure: "#f85149",
    pending: "#d29922",
  }

  return (
    <span className={styles.statusDot} style={{ backgroundColor: colors[status] }} title={status} />
  )
}

function getCIStatus(pr: {
  state: string
  merged?: boolean | null
  draft?: boolean | null
  prChecks?: Array<{ status?: string | null; conclusion?: string | null }> | null
}): CIStatus {
  const checksSummary = getChecksSummary(pr.prChecks)
  if (checksSummary) {
    if (checksSummary.failure > 0) return "failure"
    if (checksSummary.pending > 0) return "pending"
    return "success"
  }

  if (pr.draft) {
    return "pending"
  }
  if (pr.merged) {
    return "success"
  }
  if (pr.state === "closed") {
    return "failure"
  }
  return "success"
}

const getChecksSummary = (
  checks: Array<{ status?: string | null; conclusion?: string | null }> | null | undefined,
): { success: number; failure: number; pending: number; total: number } | null => {
  if (!checks || checks.length === 0) return null

  let success = 0
  let failure = 0
  let pending = 0
  for (const check of checks) {
    if (check.status !== "completed") {
      pending++
      continue
    }

    switch (check.conclusion) {
      case "success":
      case "neutral":
      case "skipped":
        success++
        break
      case "failure":
      case "timed_out":
      case "action_required":
      case "cancelled":
        failure++
        break
      default:
        pending++
    }
  }

  return {
    success,
    failure,
    pending,
    total: checks.length,
  }
}

function formatDate(date: Date | number | string | null | undefined): string {
  if (!date) return ""
  const d =
    typeof date === "number" ? new Date(date) : typeof date === "string" ? new Date(date) : date
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

type PRStatus = "open" | "closed" | "merged" | "draft"

const getPRStatus = (pr: {
  state: string
  merged?: boolean | null
  draft?: boolean | null
}): PRStatus => {
  if (pr.draft) return "draft"
  if (pr.merged) return "merged"
  if (pr.state === "closed") return "closed"
  return "open"
}

const StatusIcon = ({ status }: { status: PRStatus }) => {
  switch (status) {
    case "merged":
      return <GitMergeIcon size={16} className={`${styles.statusIcon} ${styles.statusMerged}`} />
    case "closed":
      return (
        <GitPullRequestClosedIcon
          size={16}
          className={`${styles.statusIcon} ${styles.statusClosed}`}
        />
      )
    case "draft":
      return (
        <GitPullRequestDraftIcon
          size={16}
          className={`${styles.statusIcon} ${styles.statusDraft}`}
        />
      )
    default:
      return (
        <GitPullRequestIcon size={16} className={`${styles.statusIcon} ${styles.statusOpen}`} />
      )
  }
}

export function PRListItem({ pr, repoFullName, isApproved, searchParams }: PRListItemProps) {
  const totalComments = (pr.comments ?? 0) + (pr.reviewComments ?? 0)
  const checksSummary = getChecksSummary(pr.prChecks)
  const ciStatus = getCIStatus(pr)
  const prStatus = getPRStatus(pr)

  return (
    <Link
      to="/$owner/$repo/pull/$number"
      params={{
        owner: repoFullName.split("/")[0],
        repo: repoFullName.split("/")[1],
        number: String(pr.number),
      }}
      search={searchParams}
      className={styles.prItem}
      activeOptions={{ exact: true }}
      activeProps={{ className: `${styles.prItem} ${styles.prItemActive}` }}
    >
      <div className={styles.leadingIcon}>
        <StatusIcon status={prStatus} />
      </div>

      {/* Left side content */}
      <div className={styles.prContent}>
        <h3 className={styles.prTitle}>
          {pr.draft && <span className={styles.draftBadge}>Draft</span>}
          <span className={styles.prTitleText}>{pr.title}</span>
        </h3>

        <div className={styles.prMeta}>
          <Avatar src={pr.authorAvatarUrl} name={pr.authorLogin} size={16} />
          {pr.authorLogin && <span className={styles.authorName}>{pr.authorLogin}</span>}
          <span className={styles.prPath}>
            {repoFullName}/{pr.number}
          </span>
        </div>
      </div>

      {/* Right side actions */}
      <div className={styles.prActions}>
        <div className={styles.actionsTopRow}>
          {isApproved && (
            <span className={styles.approvedIndicator} title="Approved">
              <CheckIcon size={12} />
              Approved
            </span>
          )}
          <span className={styles.prDate}>
            {formatDate(pr.githubUpdatedAt || pr.githubCreatedAt)}
          </span>
        </div>

        <div className={styles.actionsBottomRow}>
          {totalComments > 0 && (
            <div className={styles.commentCount}>
              <CommentIcon className={styles.commentIcon} size={16} />
              {totalComments}
            </div>
          )}
          <div className={styles.statusIndicators}>
            {checksSummary ? (
              <>
                {checksSummary.success > 0 && (
                  <span className={styles.checkPill}>
                    <StatusDot status="success" />
                    {checksSummary.success}
                  </span>
                )}
                {checksSummary.pending > 0 && (
                  <span className={styles.checkPill}>
                    <StatusDot status="pending" />
                    {checksSummary.pending}
                  </span>
                )}
                {checksSummary.failure > 0 && (
                  <span className={styles.checkPill}>
                    <StatusDot status="failure" />
                    {checksSummary.failure}
                  </span>
                )}
              </>
            ) : (
              <StatusDot status={ciStatus} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
