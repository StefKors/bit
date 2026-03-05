import { GitCommitIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { Avatar } from "@/components/Avatar"
import type { PullRequestCommit } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelineCommitItem.module.css"

interface TimelineCommitItemProps {
  commit: PullRequestCommit
}

export const TimelineCommitItem = ({ commit }: TimelineCommitItemProps) => {
  const shortSha = commit.sha.slice(0, 7)

  return (
    <TimelineItemBase
      icon={<GitCommitIcon size={16} />}
      header={
        <>
          <span className={styles.timelineCommitInfo}>
            {commit.authorLogin && (
              <Avatar src={commit.authorAvatarUrl} name={commit.authorLogin} size={16} />
            )}
            <span className={styles.timelineAuthor}>{commit.authorLogin ?? "unknown"}</span>
            <span className={styles.timelineCommitVerb}>committed</span>
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(commit.authoredAt)}</time>
        </>
      }
    >
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
    </TimelineItemBase>
  )
}
