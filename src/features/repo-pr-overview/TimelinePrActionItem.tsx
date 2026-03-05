import { TagIcon, PersonIcon, EyeIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import type { PullRequestEvent } from "./Types"
import { TimelineItemBase } from "./TimelineItemBase"
import styles from "./TimelinePrActionItem.module.css"

interface TimelinePrActionItemProps {
  event: PullRequestEvent
}

const eventConfig: Record<string, { icon: React.ReactNode; verb: string }> = {
  labeled: { icon: <TagIcon size={10} />, verb: "added" },
  unlabeled: { icon: <TagIcon size={10} />, verb: "removed" },
  assigned: { icon: <PersonIcon size={10} />, verb: "assigned" },
  unassigned: { icon: <PersonIcon size={10} />, verb: "unassigned" },
  review_requested: { icon: <EyeIcon size={10} />, verb: "requested review from" },
  review_request_removed: { icon: <EyeIcon size={10} />, verb: "removed review request for" },
}

export const TimelinePrActionItem = ({ event }: TimelinePrActionItemProps) => {
  const config = eventConfig[event.eventType]
  if (!config) return null

  const isLabel = event.eventType === "labeled" || event.eventType === "unlabeled"

  return (
    <TimelineItemBase
      icon={config.icon}
      showConnector
      header={
        <>
          <span className={styles.eventInfo}>
            {event.actorLogin && (
              <AuthorLabel
                login={event.actorLogin}
                avatarUrl={event.actorAvatarUrl}
                size={13}
                lineHeight="default"
              />
            )}
            <span className={styles.eventVerb}>{config.verb}</span>
            {isLabel && event.label && <span className={styles.label}>{event.label}</span>}
            {!isLabel && event.targetLogin && (
              <AuthorLabel
                login={event.targetLogin}
                avatarUrl={event.targetAvatarUrl}
                size={13}
                lineHeight="default"
              />
            )}
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(event.githubCreatedAt)}</time>
        </>
      }
    />
  )
}
