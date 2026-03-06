import { GitCommitIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { CiDot } from "@/components/CiDot"
import type { PullRequestCheckRun, PullRequestCommit } from "./Types"
import { getCheckRunsCiVariant } from "./Utils"
import { TimelineItem, TimelineItemHeader, TimelineItemIcon } from "./TimelineItemBase"
import styles from "./TimelineCommitItem.module.css"

interface TimelineCommitItemProps {
  commit: PullRequestCommit
  checkRuns?: PullRequestCheckRun[]
  headSha?: string | null
}

export const TimelineCommitItem = ({
  commit,
  checkRuns = [],
  headSha,
}: TimelineCommitItemProps) => {
  const shortSha = commit.sha.slice(0, 7)
  const title = commit.messageShort ?? commit.message?.split("\n")[0] ?? ""
  const authorLogin = commit.authorLogin ?? "unknown"
  const isHeadCommit = headSha != null && commit.sha === headSha
  const ciVariant = isHeadCommit ? getCheckRunsCiVariant(checkRuns) : null

  return (
    <TimelineItem>
      <TimelineItemIcon>
        <GitCommitIcon size={12} />
      </TimelineItemIcon>
      <TimelineItemHeader>
        <span className={styles.timelineCommitLine}>
          <AuthorLabel
            login={authorLogin}
            avatarUrl={commit.authorAvatarUrl}
            size={13}
            lineHeight="default"
          />
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
          <span className={styles.timelineCommitTitle}>{title}</span>
          <time className={styles.timelineTime}>{formatRelativeTime(commit.authoredAt)}</time>
          {ciVariant != null && <CiDot variant={ciVariant} />}
        </span>
      </TimelineItemHeader>
    </TimelineItem>
  )
}
