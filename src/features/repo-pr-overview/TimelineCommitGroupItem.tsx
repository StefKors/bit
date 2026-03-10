import { RepoPushIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import type { PullRequestCheckRun, PullRequestCommit } from "./Types"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineItem, TimelineItemHeader, TimelineItemIcon } from "./TimelineItemBase"
import styles from "./TimelineCommitGroupItem.module.css"

interface TimelineCommitGroupItemProps {
  pushAuthorLogin: string
  pushAuthorAvatarUrl: string | null
  commits: PullRequestCommit[]
  checkRuns?: PullRequestCheckRun[]
  timestamp: number
}

export const TimelineCommitGroupItem = ({
  pushAuthorLogin,
  pushAuthorAvatarUrl,
  commits,
  checkRuns = [],
  timestamp,
}: TimelineCommitGroupItemProps) => {
  return (
    <TimelineItem>
      <TimelineItemIcon>
        <RepoPushIcon size={12} />
      </TimelineItemIcon>
      <TimelineItemHeader>
        <span className={styles.headerLine}>
          <AuthorLabel
            login={pushAuthorLogin}
            avatarUrl={pushAuthorAvatarUrl}
            size={13}
            lineHeight="default"
          />
          <span className={styles.verb}>
            pushed {commits.length} commit{commits.length === 1 ? "" : "s"}
          </span>
        </span>
        <time className={styles.timelineTime}>{formatRelativeTime(timestamp)}</time>
      </TimelineItemHeader>
      <div className={styles.commits}>
        {commits.map((commit, index) => (
          <TimelineCommitItem
            key={commit.id}
            commit={commit}
            checkRuns={checkRuns}
            condensed={index > 0}
          />
        ))}
      </div>
    </TimelineItem>
  )
}
