import { motion } from "motion/react"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineIssueCommentItem } from "./TimelineIssueCommentItem"
import { TimelineList } from "./TimelineItemBase"
import { TimelinePrActionItem } from "./TimelinePrActionItem"
import { TimelinePrEventItem } from "./TimelinePrEventItem"
import { TimelineReviewCommentItem } from "./TimelineReviewCommentItem"
import { TimelineReviewItem } from "./TimelineReviewItem"
import { getTimelineItemKey } from "./TimelineUtils"
import type { PullRequestCheckRun, PullRequestCommit, TimelineItem } from "./Types"
import styles from "./TimelineItemBase.module.css"

interface TimelineProps {
  items: TimelineItem[]
  className?: string
  itemMotionClassName?: string
  checkRuns?: PullRequestCheckRun[]
  headSha?: string | null
  getHeadShaForCommit?: (commit: PullRequestCommit) => string | null | undefined
  animatedItemKeys?: Set<string>
  onItemAnimationComplete?: (itemKey: string) => void
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
  headSha,
  getHeadShaForCommit,
  animatedItemKeys,
  onItemAnimationComplete,
}: TimelineProps) => (
  <TimelineList className={className}>
    <div className={styles.timelineLine} aria-hidden />
    {items.map((item) => {
      const itemKey = getTimelineItemKey(item)
      const shouldAnimateIn = animatedItemKeys?.has(itemKey) ?? false
      const onComplete =
        shouldAnimateIn && onItemAnimationComplete
          ? () => {
              onItemAnimationComplete(itemKey)
            }
          : undefined

      if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
        return (
          <motion.div
            key={itemKey}
            className={itemMotionClassName}
            {...buildItemMotionProps(shouldAnimateIn, onComplete)}
          >
            <TimelinePrEventItem type={item.type} event={item.data} timestamp={item.timestamp} />
          </motion.div>
        )
      }
      if (item.type === "pr_event") {
        return (
          <motion.div
            key={itemKey}
            className={itemMotionClassName}
            {...buildItemMotionProps(shouldAnimateIn, onComplete)}
          >
            <TimelinePrActionItem event={item.data} />
          </motion.div>
        )
      }
      if (item.type === "commit") {
        const effectiveHeadSha = getHeadShaForCommit ? getHeadShaForCommit(item.data) : headSha
        return (
          <motion.div
            key={itemKey}
            className={itemMotionClassName}
            {...buildItemMotionProps(shouldAnimateIn, onComplete)}
          >
            <TimelineCommitItem
              commit={item.data}
              checkRuns={checkRuns}
              headSha={effectiveHeadSha}
            />
          </motion.div>
        )
      }
      if (item.type === "review") {
        return (
          <motion.div
            key={itemKey}
            className={itemMotionClassName}
            {...buildItemMotionProps(shouldAnimateIn, onComplete)}
          >
            <TimelineReviewItem review={item.data} />
          </motion.div>
        )
      }
      if (item.type === "issue_comment") {
        return (
          <motion.div
            key={itemKey}
            className={itemMotionClassName}
            {...buildItemMotionProps(shouldAnimateIn, onComplete)}
          >
            <TimelineIssueCommentItem comment={item.data} />
          </motion.div>
        )
      }
      return (
        <motion.div
          key={itemKey}
          className={itemMotionClassName}
          {...buildItemMotionProps(shouldAnimateIn, onComplete)}
        >
          <TimelineReviewCommentItem thread={item.data} />
        </motion.div>
      )
    })}
  </TimelineList>
)
