import { Link } from "@tanstack/react-router"
import {
  GitPullRequestIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  CommentIcon,
} from "@primer/octicons-react"
import { Avatar } from "@/components/Avatar"
import { formatTimeAgo } from "@/lib/dashboard-utils"
import styles from "./PRTable.module.css"

interface PREntry {
  id: string
  number: number
  title: string
  state: string
  draft?: boolean | null
  merged?: boolean | null
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  comments?: number | null
  reviewComments?: number | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
  repo?: { fullName: string } | null
  prChecks?: Array<{ status: string; conclusion?: string | null }> | null
}

const PRStatusIcon = ({ pr }: { pr: PREntry }) => {
  if (pr.draft) return <GitPullRequestDraftIcon size={14} className={styles.statusDraft} />
  if (pr.merged) return <GitMergeIcon size={14} className={styles.statusMerged} />
  if (pr.state === "closed")
    return <GitPullRequestClosedIcon size={14} className={styles.statusClosed} />
  return <GitPullRequestIcon size={14} className={styles.statusOpen} />
}

const CIBadge = ({ checks }: { checks: PREntry["prChecks"] }) => {
  if (!checks || checks.length === 0) return null
  let success = 0
  let failure = 0
  let pending = 0
  for (const c of checks) {
    if (c.status !== "completed") {
      pending++
    } else if (
      c.conclusion === "success" ||
      c.conclusion === "neutral" ||
      c.conclusion === "skipped"
    ) {
      success++
    } else {
      failure++
    }
  }

  if (failure > 0)
    return <span className={`${styles.ciBadge} ${styles.ciFail}`}>{failure} failing</span>
  if (pending > 0)
    return <span className={`${styles.ciBadge} ${styles.ciPending}`}>{pending} pending</span>
  return <span className={`${styles.ciBadge} ${styles.ciPass}`}>{success} passed</span>
}

const PRRow = ({ pr }: { pr: PREntry }) => {
  const repoFullName = pr.repo?.fullName ?? ""
  const [owner, repo] = repoFullName.split("/")
  const totalComments = (pr.comments ?? 0) + (pr.reviewComments ?? 0)
  const timestamp = pr.githubUpdatedAt ?? pr.githubCreatedAt

  return (
    <Link
      to="/$owner/$repo/pull/$number"
      params={{ owner, repo, number: String(pr.number) }}
      className={styles.row}
    >
      <div className={styles.statusCol}>
        <PRStatusIcon pr={pr} />
      </div>
      <div className={styles.mainCol}>
        <span className={styles.prTitle}>{pr.title}</span>
        <span className={styles.prMeta}>
          {repoFullName}#{pr.number}
        </span>
      </div>
      <div className={styles.authorCol}>
        <Avatar src={pr.authorAvatarUrl} name={pr.authorLogin} size={18} />
      </div>
      <div className={styles.ciCol}>
        <CIBadge checks={pr.prChecks} />
      </div>
      <div className={styles.commentCol}>
        {totalComments > 0 && (
          <>
            <CommentIcon size={12} className={styles.commentIcon} />
            <span>{totalComments}</span>
          </>
        )}
      </div>
      <div className={styles.timeCol}>{timestamp ? formatTimeAgo(timestamp) : "—"}</div>
    </Link>
  )
}

interface PRTableProps {
  prs: PREntry[]
  emptyText?: string
}

export const PRTable = ({ prs, emptyText = "No pull requests." }: PRTableProps) => {
  if (prs.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={styles.table}>
      {prs.map((pr) => (
        <PRRow key={pr.id} pr={pr} />
      ))}
    </div>
  )
}
