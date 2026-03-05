import { GitCommitIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/format"
import { Avatar } from "@/components/Avatar"
import type { PullRequestCommit } from "./types"
import styles from "./TimelineCommitItem.module.css"

interface TimelineCommitItemProps {
  commit: PullRequestCommit
}

export function TimelineCommitItem({ commit }: TimelineCommitItemProps) {
  const shortSha = commit.sha.slice(0, 7)

  return (
    <div className={`${styles.timelineItem} ${styles.timelineCommit}`}>
      <div className={styles.timelineIcon}>
        <GitCommitIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineCommitInfo}>
            {commit.authorLogin && (
              <Avatar src={commit.authorAvatarUrl} name={commit.authorLogin} size={16} />
            )}
            <span className={styles.timelineAuthor}>{commit.authorLogin ?? "unknown"}</span>
            <span className={styles.timelineCommitVerb}>committed</span>
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(commit.authoredAt)}</time>
        </div>
        <span className={styles.timelineCommitMessage}>
          {commit.htmlUrl ? (
            <a
              href={commit.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.timelineCommitSha}
            >
              {shortSha}
            </a>
          ) : (
            <code className={styles.timelineCommitShaPlain}>{shortSha}</code>
          )}
          {commit.messageShort ?? commit.message?.split("\n")[0] ?? ""}
        </span>
      </div>
    </div>
  )
}
