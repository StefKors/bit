import { Avatar } from "@/components/Avatar"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubPrCommit = InstaQLEntity<AppSchema, "prCommits">
import styles from "./PRCommitsTab.module.css"

interface PRCommitsTabProps {
  commits: readonly GithubPrCommit[]
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

export const PRCommitsTab = ({ commits, formatTimeAgo }: PRCommitsTabProps) => {
  return (
    <div className={styles.container}>
      {commits.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No commits synced yet. Click "Sync Details" to fetch commits.
          </p>
        </div>
      ) : (
        <div className={styles.commitsList}>
          {commits.map((commit) => (
            <CommitItem key={commit.id} commit={commit} formatTimeAgo={formatTimeAgo} />
          ))}
        </div>
      )}
    </div>
  )
}

interface CommitItemProps {
  commit: GithubPrCommit
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

const CommitItem = ({ commit, formatTimeAgo }: CommitItemProps) => {
  // Get the first line of the commit message as the title
  const message = String(commit.message ?? "")
  const [title, ...bodyLines] = message.split("\n")
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
          {body && <span className={styles.hasBody}>…</span>}
        </div>
        <div className={styles.commitMeta}>
          <span className={styles.author}>
            {commit.authorLogin || commit.authorName || "Unknown"}
          </span>
          <span className={styles.separator}>•</span>
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
