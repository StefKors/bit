import {
  RepoIcon,
  LockIcon,
  StarIcon,
  RepoForkedIcon,
  IssueOpenedIcon,
  DotFillIcon,
  BroadcastIcon,
  GitPullRequestIcon,
  ClockIcon,
} from "@primer/octicons-react"
import styles from "./RepoHeader.module.css"

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
}

interface RepoLike {
  name: string
  fullName?: string
  private?: boolean
  description?: string | null
  language?: string | null
  stargazersCount?: number | null
  forksCount?: number | null
  openIssuesCount?: number | null
  webhookStatus?: string | null
  webhookError?: string | null
  syncedAt?: number | null
  pullRequests?: readonly { id: string }[]
  issues?: readonly { id: string }[]
}

interface RepoHeaderProps {
  repo: RepoLike
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

const WebhookBadge = ({ status, error }: { status?: string | null; error?: string | null }) => {
  if (!status || status === "not_installed") {
    return (
      <span className={`${styles.syncBadge} ${styles.syncBadgeInactive}`} title="No webhooks">
        <BroadcastIcon size={12} />
        No webhooks
      </span>
    )
  }
  if (status === "installed") {
    return (
      <span className={`${styles.syncBadge} ${styles.syncBadgeActive}`} title="Webhooks active">
        <BroadcastIcon size={12} />
        Live
      </span>
    )
  }
  if (status === "no_access") {
    return (
      <span
        className={`${styles.syncBadge} ${styles.syncBadgeInactive}`}
        title="No permission to install webhooks"
      >
        <BroadcastIcon size={12} />
        No access
      </span>
    )
  }
  return (
    <span className={`${styles.syncBadge} ${styles.syncBadgeError}`} title={error || "Error"}>
      <BroadcastIcon size={12} />
      Error
    </span>
  )
}

export function RepoHeader({ repo }: RepoHeaderProps) {
  const prCount = repo.pullRequests?.length ?? 0
  const issueCount = repo.issues?.length ?? 0
  const hasPRs = prCount > 0
  const hasIssues = issueCount > 0

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>
          <RepoIcon className={styles.repoIcon} size={20} />
          {repo.name}
          {repo.private && <LockIcon className={styles.privateIcon} size={14} />}
        </h1>
        {repo.description && <p className={styles.description}>{repo.description}</p>}
        <div className={styles.meta}>
          {repo.language && (
            <span className={styles.metaItem}>
              <span
                className={styles.languageDot}
                style={{
                  backgroundColor: languageColors[repo.language] || "#8b949e",
                }}
              />
              {repo.language}
            </span>
          )}
          <span className={styles.metaItem}>
            <StarIcon className={styles.metaIcon} size={16} />
            {repo.stargazersCount} stars
          </span>
          <span className={styles.metaItem}>
            <RepoForkedIcon className={styles.metaIcon} size={16} />
            {repo.forksCount} forks
          </span>
          <span className={styles.metaItem}>
            <IssueOpenedIcon className={styles.metaIcon} size={16} />
            {repo.openIssuesCount} open issues
          </span>
        </div>

        <div className={styles.syncRow}>
          <WebhookBadge status={repo.webhookStatus} error={repo.webhookError} />

          <span
            className={`${styles.syncBadge} ${hasPRs ? styles.syncBadgeActive : styles.syncBadgeInactive}`}
          >
            <GitPullRequestIcon size={12} />
            {hasPRs ? `${prCount} PRs synced` : "No PRs"}
          </span>

          <span
            className={`${styles.syncBadge} ${hasIssues ? styles.syncBadgeActive : styles.syncBadgeInactive}`}
          >
            <IssueOpenedIcon size={12} />
            {hasIssues ? `${issueCount} issues` : "No issues"}
          </span>

          {repo.syncedAt ? (
            <span className={styles.syncTime}>
              <ClockIcon size={12} />
              Synced {formatTimeAgo(repo.syncedAt)}
            </span>
          ) : (
            <span className={styles.syncTime}>
              <DotFillIcon size={12} />
              Not synced yet
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
