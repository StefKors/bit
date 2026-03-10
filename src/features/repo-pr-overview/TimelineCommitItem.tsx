import { useState } from "react"
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
  condensed?: boolean
}

export const TimelineCommitItem = ({
  commit,
  checkRuns = [],
  condensed = false,
}: TimelineCommitItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const shortSha = commit.sha.slice(0, 7)
  const title = commit.messageShort ?? commit.message?.split("\n")[0] ?? ""
  const authorLogin = commit.authorLogin ?? "unknown"
  const commitCheckRuns = checkRuns.filter((checkRun) => checkRun.headSha === commit.sha)
  const ciVariant = getCheckRunsCiVariant(commitCheckRuns)
  const hasMessageBody = Boolean(commit.message?.includes("\n"))
  const fullMessage = commit.message ?? title

  if (condensed) {
    return (
      <div className={styles.condensedLine}>
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
        <span className={styles.condensedTitle}>{title}</span>
        {ciVariant != null && <CiDot variant={ciVariant} />}
      </div>
    )
  }

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
          <span
            className={
              isExpanded
                ? `${styles.timelineCommitTitle} ${styles.timelineCommitTitleExpanded}`
                : styles.timelineCommitTitle
            }
          >
            {isExpanded ? fullMessage : title}
            {hasMessageBody && (
              <button
                type="button"
                className={styles.expandButton}
                onClick={() => {
                  setIsExpanded(!isExpanded)
                }}
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            )}
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(commit.authoredAt)}</time>
          {ciVariant != null && <CiDot variant={ciVariant} />}
        </span>
      </TimelineItemHeader>
    </TimelineItem>
  )
}
