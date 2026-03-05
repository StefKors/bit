import { GitMergeIcon, GitPullRequestIcon, GitPullRequestClosedIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import type { PrEventData } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelinePrEventItem.module.css"

interface TimelinePrEventItemProps {
  event: PrEventData
  type: "opened" | "merged" | "closed"
  timestamp: number
}

const config = {
  opened: {
    icon: <GitPullRequestIcon size={10} />,
    verb: "opened this pull request",
    className: styles.opened,
  },
  merged: {
    icon: <GitMergeIcon size={10} />,
    verb: "merged this pull request",
    className: styles.merged,
  },
  closed: {
    icon: <GitPullRequestClosedIcon size={10} />,
    verb: "closed this pull request",
    className: styles.closed,
  },
} as const

export const TimelinePrEventItem = ({ event, type, timestamp }: TimelinePrEventItemProps) => {
  const { icon, verb, className } = config[type]

  return (
    <TimelineItemBase
      icon={icon}
      className={className}
      showConnector
      header={
        <>
          <span className={styles.eventInfo}>
            <AuthorLabel
              login={event.authorLogin}
              avatarUrl={event.authorAvatarUrl}
              size={13}
              lineHeight="default"
            />
            <span className={styles.eventVerb}>{verb}</span>
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(timestamp)}</time>
        </>
      }
    />
  )
}
