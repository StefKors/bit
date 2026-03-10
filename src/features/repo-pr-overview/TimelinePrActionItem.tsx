import {
  EyeIcon,
  GitPullRequestDraftIcon,
  PencilIcon,
  PersonIcon,
  TagIcon,
} from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import type { PullRequestEvent } from "./Types"
import { TimelineItem, TimelineItemHeader, TimelineItemIcon } from "./TimelineItemBase"
import styles from "./TimelinePrActionItem.module.css"

interface TimelinePrActionItemProps {
  event: PullRequestEvent
}

const eventConfig: Record<string, { icon: React.ReactNode; verb: string }> = {
  labeled: { icon: <TagIcon size={12} />, verb: "added" },
  unlabeled: { icon: <TagIcon size={12} />, verb: "removed" },
  assigned: { icon: <PersonIcon size={12} />, verb: "assigned" },
  unassigned: { icon: <PersonIcon size={12} />, verb: "unassigned" },
  review_requested: { icon: <EyeIcon size={12} />, verb: "requested review from" },
  review_request_removed: { icon: <EyeIcon size={12} />, verb: "removed review request for" },
  renamed: { icon: <PencilIcon size={12} />, verb: "changed the title" },
  ready_for_review: {
    icon: <EyeIcon size={12} />,
    verb: "marked this pull request as ready for review",
  },
  converted_to_draft: {
    icon: <GitPullRequestDraftIcon size={12} />,
    verb: "converted this pull request to draft",
  },
}

const parseRenamedLabel = (
  label: string | null,
): {
  from?: string
  to?: string
} => {
  if (!label) return {}
  try {
    const parsed = JSON.parse(label) as { from?: string; to?: string }
    return {
      from: typeof parsed.from === "string" ? parsed.from : undefined,
      to: typeof parsed.to === "string" ? parsed.to : undefined,
    }
  } catch {
    return {}
  }
}

export const TimelinePrActionItem = ({ event }: TimelinePrActionItemProps) => {
  const config = eventConfig[event.eventType]
  if (!config) return null

  const isLabel = event.eventType === "labeled" || event.eventType === "unlabeled"
  const isRenamed = event.eventType === "renamed"
  const renamed = isRenamed ? parseRenamedLabel(event.label) : null

  return (
    <TimelineItem>
      <TimelineItemIcon>{config.icon}</TimelineItemIcon>
      <TimelineItemHeader>
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
            {isRenamed && (renamed?.from || renamed?.to) ? (
              <span className={styles.titleChange}>
                {renamed?.from ? <del>{renamed.from}</del> : null}
                {renamed?.to ? <span className={styles.newTitle}>{renamed.to}</span> : null}
              </span>
            ) : null}
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
      </TimelineItemHeader>
    </TimelineItem>
  )
}
