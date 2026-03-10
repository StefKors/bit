import { Fragment } from "react"
import { motion } from "motion/react"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineCommitGroupItem } from "./TimelineCommitGroupItem"
import { TimelineIssueCommentItem } from "./TimelineIssueCommentItem"
import { TimelineList } from "./TimelineItemBase"
import { TimelinePrActionItem } from "./TimelinePrActionItem"
import { TimelinePrEventItem } from "./TimelinePrEventItem"
import { TimelineReviewCommentItem } from "./TimelineReviewCommentItem"
import { TimelineReviewItem } from "./TimelineReviewItem"
import { getTimelineItemKey } from "./TimelineUtils"
import type { PullRequestCheckRun, PullRequestReaction, TimelineItem } from "./Types"
import styles from "./TimelineItemBase.module.css"

interface TimelineProps {
  items: TimelineItem[]
  className?: string
  itemMotionClassName?: string
  checkRuns?: PullRequestCheckRun[]
  reactions?: PullRequestReaction[]
  animatedItemKeys?: Set<string>
  onItemAnimationComplete?: (itemKey: string) => void
  newChangesSinceTimestamp?: number | null
  newChangesLabel?: string
}

const ENTER_INITIAL = { opacity: 0, y: 14 }
const ENTER_ANIMATE = { opacity: 1, y: 0 }
const ENTER_TRANSITION = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const }

const buildItemMotionProps = (
  shouldAnimateIn: boolean,
  onComplete?: () => void,
): {
  initial: false | { opacity: number; y: number }
  animate: { opacity: number; y: number }
  transition: { duration: number; ease: readonly [number, number, number, number] }
  onAnimationComplete?: () => void
} => ({
  initial: shouldAnimateIn ? ENTER_INITIAL : false,
  animate: ENTER_ANIMATE,
  transition: ENTER_TRANSITION,
  ...(onComplete ? { onAnimationComplete: onComplete } : {}),
})

export const Timeline = ({
  items,
  className,
  itemMotionClassName,
  checkRuns = [],
  reactions = [],
  animatedItemKeys,
  onItemAnimationComplete,
  newChangesSinceTimestamp,
  newChangesLabel = "New changes since you last viewed",
}: TimelineProps) => {
  const firstNewItemIndex =
    newChangesSinceTimestamp == null
      ? -1
      : items.findIndex((timelineItem) => timelineItem.timestamp > newChangesSinceTimestamp)

  return (
    <TimelineList className={className}>
      <div className={styles.timelineLine} aria-hidden />
      {items.map((item, index) => {
        const itemKey = getTimelineItemKey(item)
        const shouldRenderUnreadMarker = firstNewItemIndex >= 0 && index === firstNewItemIndex
        const shouldAnimateIn = animatedItemKeys?.has(itemKey) ?? false
        const onComplete =
          shouldAnimateIn && onItemAnimationComplete
            ? () => {
                onItemAnimationComplete(itemKey)
              }
            : undefined

        return (
          <Fragment key={itemKey}>
            {shouldRenderUnreadMarker ? (
              <div className={styles.timelineUnreadMarker} role="status" aria-live="polite">
                <span>{newChangesLabel}</span>
              </div>
            ) : null}
            {item.type === "opened" || item.type === "merged" || item.type === "closed" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelinePrEventItem
                  type={item.type}
                  event={item.data}
                  timestamp={item.timestamp}
                />
              </motion.div>
            ) : item.type === "pr_event" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelinePrActionItem event={item.data} />
              </motion.div>
            ) : item.type === "commit" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelineCommitItem commit={item.data} checkRuns={checkRuns} />
              </motion.div>
            ) : item.type === "commit_group" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelineCommitGroupItem
                  pushAuthorLogin={item.data.pushAuthorLogin}
                  pushAuthorAvatarUrl={item.data.pushAuthorAvatarUrl}
                  commits={item.data.commits}
                  checkRuns={checkRuns}
                  timestamp={item.timestamp}
                />
              </motion.div>
            ) : item.type === "review" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelineReviewItem review={item.data} reactions={reactions} />
              </motion.div>
            ) : item.type === "issue_comment" ? (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelineIssueCommentItem
                  comment={item.data}
                  reactions={reactions.filter(
                    (reaction) =>
                      reaction.targetType === "issue_comment" &&
                      reaction.targetGithubId === item.data.githubId &&
                      reaction.count > 0,
                  )}
                />
              </motion.div>
            ) : (
              <motion.div
                className={itemMotionClassName}
                {...buildItemMotionProps(shouldAnimateIn, onComplete)}
              >
                <TimelineReviewCommentItem thread={item.data} reactions={reactions} />
              </motion.div>
            )}
          </Fragment>
        )
      })}
    </TimelineList>
  )
}
