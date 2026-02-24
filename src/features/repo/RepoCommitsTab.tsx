import { useMemo, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { GitCommitIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncCommitsMutation } from "@/lib/mutations"
import { Avatar } from "@/components/Avatar"
import styles from "./RepoCommitsTab.module.css"

interface RepoCommitsTabProps {
  repoId: string
  fullName: string
  branch: string
  webhookStatus?: string | null
}

interface RepoCommitData {
  id: string
  sha: string
  message: string
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  authorName?: string | null
  htmlUrl?: string | null
  committedAt?: number | null
}

const formatTimeAgo = (date: number | null | undefined): string => {
  if (!date) return ""
  const now = Date.now()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export const RepoCommitsTab = ({
  repoId,
  fullName,
  branch,
  webhookStatus,
}: RepoCommitsTabProps) => {
  const { user } = useAuth()
  const [owner, repo] = fullName.split("/")
  const initialSyncTriggered = useRef(false)

  const commitsSync = useMutation(syncCommitsMutation(user?.id ?? "", owner, repo, branch))
  const syncing = commitsSync.isPending

  const { data: repoData } = db.useQuery({
    repos: {
      $: { where: { id: repoId }, limit: 1 },
      repoCommits: {
        $: {
          where: { ref: branch },
          order: { committedAt: "desc" },
        },
      },
    },
  })

  const commits = useMemo<RepoCommitData[]>(() => {
    const data = (repoData as { repos?: Array<{ repoCommits?: RepoCommitData[] }> } | undefined)
      ?.repos
    return data?.[0]?.repoCommits ?? []
  }, [repoData])

  const hasWebhooks = webhookStatus === "installed"
  const commitsEmpty = repoData !== undefined && commits.length === 0
  if (hasWebhooks && commitsEmpty && user?.id && !initialSyncTriggered.current && !syncing) {
    initialSyncTriggered.current = true
    commitsSync.mutate()
  }

  if (commits.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <GitCommitIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No commits</h3>
          <p className={styles.emptyText}>
            {syncing ? "Syncing commit history..." : "No commits have been synced yet."}
          </p>
          {!syncing && (
            <button className={styles.syncButton} onClick={() => commitsSync.mutate()}>
              Sync Commits
            </button>
          )}
        </div>
      </div>
    )
  }

  // Group commits by date
  const grouped = groupCommitsByDate(commits)

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <span className={styles.commitCount}>{commits.length} commits</span>
        <button
          className={styles.syncButtonSmall}
          onClick={() => commitsSync.mutate()}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>
      {grouped.map(([dateLabel, dateCommits]) => (
        <div key={dateLabel} className={styles.dateGroup}>
          <div className={styles.dateHeader}>
            <GitCommitIcon size={14} />
            <span>{dateLabel}</span>
          </div>
          <div className={styles.commitsList}>
            {dateCommits.map((commit) => (
              <CommitItem key={commit.id} commit={commit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const CommitItem = ({ commit }: { commit: RepoCommitData }) => {
  const [title, ...bodyLines] = commit.message.split("\n")
  const body = bodyLines.join("\n").trim()
  const shortSha = commit.sha.slice(0, 7)

  return (
    <div className={styles.commitItem}>
      <Avatar
        src={commit.authorAvatarUrl}
        name={commit.authorLogin || commit.authorName}
        size={36}
      />
      <div className={styles.commitContent}>
        <div className={styles.commitHeader}>
          <span className={styles.commitTitle}>{title}</span>
          {Boolean(body) && <span className={styles.hasBody}>…</span>}
        </div>
        <div className={styles.commitMeta}>
          <span className={styles.author}>
            {commit.authorLogin || commit.authorName || "Unknown"}
          </span>
          <span className={styles.separator}>·</span>
          <span className={styles.time}>{formatTimeAgo(commit.committedAt)}</span>
        </div>
      </div>
      <div className={styles.commitActions}>
        {commit.htmlUrl ? (
          <a
            href={commit.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shaLink}
          >
            {shortSha}
          </a>
        ) : (
          <span className={styles.sha}>{shortSha}</span>
        )}
      </div>
    </div>
  )
}

const groupCommitsByDate = (commits: RepoCommitData[]): [string, RepoCommitData[]][] => {
  const groups = new Map<string, RepoCommitData[]>()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const commit of commits) {
    const date = commit.committedAt ? new Date(commit.committedAt) : null
    let label: string
    if (!date) {
      label = "Unknown date"
    } else if (date.toDateString() === today.toDateString()) {
      label = "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday"
    } else {
      label = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      })
    }

    const existing = groups.get(label)
    if (existing) {
      existing.push(commit)
    } else {
      groups.set(label, [commit])
    }
  }

  return Array.from(groups.entries())
}
