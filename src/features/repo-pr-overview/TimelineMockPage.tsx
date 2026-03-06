import { useState } from "react"
import { motion } from "motion/react"
import { Button } from "@/components/Button"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineIssueCommentItem } from "./TimelineIssueCommentItem"
import { TimelinePrActionItem } from "./TimelinePrActionItem"
import { TimelinePrEventItem } from "./TimelinePrEventItem"
import { TimelineReviewCommentItem } from "./TimelineReviewCommentItem"
import { TimelineReviewItem } from "./TimelineReviewItem"
import type { TimelineItem } from "./Types"
import styles from "./TimelineMockPage.module.css"

interface TimelineMockPageProps {
  owner: string
  repo: string
}

const CHECK_RUNS = [
  {
    id: "check-main",
    name: "CI / build-and-test",
    status: "completed",
    conclusion: "success",
    updatedAt: Date.now(),
  },
]

const ENTER_INITIAL = { opacity: 0, y: 14 }
const ENTER_ANIMATE = { opacity: 1, y: 0 }
const ENTER_TRANSITION = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const }

const buildMockTimelineItem = (index: number, timestamp: number): TimelineItem => {
  const variant = index % 7

  if (variant === 0) {
    return {
      type: "opened",
      timestamp,
      data: {
        authorLogin: "stefkors",
        authorAvatarUrl: "https://avatars.githubusercontent.com/u/1133416?v=4",
      },
    }
  }

  if (variant === 1) {
    return {
      type: "commit",
      timestamp,
      data: {
        id: `commit-${index}`,
        sha: `abcdef1234567890${index.toString().padStart(4, "0")}`,
        message: "Tweak timeline animation timing and easing",
        messageShort: "Tweak timeline animation timing",
        authorLogin: "stefkors",
        authorAvatarUrl: "https://avatars.githubusercontent.com/u/1133416?v=4",
        authoredAt: timestamp,
        createdAt: timestamp,
        htmlUrl: "https://github.com/octocat/Hello-World/commit/abcdef1",
      },
    }
  }

  if (variant === 2) {
    return {
      type: "review",
      timestamp,
      data: {
        id: `review-${index}`,
        githubId: index + 1000,
        authorLogin: "review-bot",
        authorAvatarUrl: "https://avatars.githubusercontent.com/u/19864447?v=4",
        state: "APPROVED",
        body: "Looks good. The motion feels smoother now.",
        htmlUrl: null,
        submittedAt: timestamp,
        updatedAt: timestamp,
        nestedCommentThreads: [],
      },
    }
  }

  if (variant === 3) {
    return {
      type: "issue_comment",
      timestamp,
      data: {
        id: `issue-comment-${index}`,
        githubId: index + 2000,
        authorLogin: "octocat",
        authorAvatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        body: "Can we make this appear animation a little snappier?",
        htmlUrl: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    }
  }

  if (variant === 4) {
    return {
      type: "review_comment",
      timestamp,
      data: {
        root: {
          id: `review-comment-root-${index}`,
          githubId: index + 3000,
          inReplyToId: null,
          pullRequestReviewId: null,
          authorLogin: "designer",
          authorAvatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
          body: "What if we reduce the delay between items?",
          path: "src/features/repo-pr-overview/TimelineItemBase.module.css",
          line: 22,
          htmlUrl: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        replies: [
          {
            id: `review-comment-reply-${index}`,
            githubId: index + 4000,
            inReplyToId: index + 3000,
            pullRequestReviewId: null,
            authorLogin: "stefkors",
            authorAvatarUrl: "https://avatars.githubusercontent.com/u/1133416?v=4",
            body: "Yep, testing 60ms stagger now.",
            path: "src/features/repo-pr-overview/TimelineItemBase.module.css",
            line: 22,
            htmlUrl: null,
            createdAt: timestamp + 20_000,
            updatedAt: timestamp + 20_000,
          },
        ],
      },
    }
  }

  if (variant === 5) {
    return {
      type: "pr_event",
      timestamp,
      data: {
        id: `event-${index}`,
        eventType: "review_requested",
        actorLogin: "stefkors",
        actorAvatarUrl: "https://avatars.githubusercontent.com/u/1133416?v=4",
        targetLogin: "review-bot",
        targetAvatarUrl: "https://avatars.githubusercontent.com/u/19864447?v=4",
        label: null,
        githubCreatedAt: timestamp,
      },
    }
  }

  return {
    type: "merged",
    timestamp,
    data: {
      authorLogin: "stefkors",
      authorAvatarUrl: "https://avatars.githubusercontent.com/u/1133416?v=4",
    },
  }
}

const getTimelineItemKey = (item: TimelineItem): string => {
  if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
    return `${item.type}-${item.timestamp}`
  }
  if (item.type === "commit") return `commit-${item.data.id}`
  if (item.type === "review") return `review-${item.data.id}`
  if (item.type === "issue_comment") return `issue-comment-${item.data.id}`
  if (item.type === "review_comment") return `review-comment-${item.data.root.id}`
  return `event-${item.data.id}`
}

export const TimelineMockPage = ({ owner, repo }: TimelineMockPageProps) => {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [animatedItemKeys, setAnimatedItemKeys] = useState<Set<string>>(new Set())

  const seedTimeline = () => {
    const now = Date.now()
    const seeded = Array.from({ length: 7 }, (_, index) =>
      buildMockTimelineItem(index, now - (7 - index) * 60_000),
    )
    setTimelineItems(seeded.toSorted((a, b) => a.timestamp - b.timestamp))
    setAnimatedItemKeys(new Set())
  }

  const addTimelineItem = () => {
    const nextItem = buildMockTimelineItem(timelineItems.length, Date.now())
    const nextItemKey = getTimelineItemKey(nextItem)

    setTimelineItems((previous) =>
      [...previous, nextItem].toSorted((a, b) => a.timestamp - b.timestamp),
    )
    setAnimatedItemKeys(new Set([nextItemKey]))
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Timeline animation playground</h1>
        <p className={styles.subtitle}>
          Repository: {owner}/{repo}
        </p>
        <div className={styles.actions}>
          <Button type="button" variant="primary" onClick={seedTimeline}>
            Seed timeline
          </Button>
          <Button type="button" onClick={addTimelineItem}>
            Add item
          </Button>
          <Button
            type="button"
            variant="invisible"
            onClick={() => {
              setTimelineItems([])
              setAnimatedItemKeys(new Set())
            }}
          >
            Clear
          </Button>
        </div>
      </header>

      <section className={styles.timelineSection}>
        {timelineItems.length > 0 ? (
          <div className={styles.timeline}>
            {timelineItems.map((item) => {
              const itemKey = getTimelineItemKey(item)
              const shouldAnimateIn = animatedItemKeys.has(itemKey)
              const handleAnimationComplete = shouldAnimateIn
                ? () => {
                    setAnimatedItemKeys((previous) => {
                      if (!previous.has(itemKey)) return previous
                      const next = new Set(previous)
                      next.delete(itemKey)
                      return next
                    })
                  }
                : undefined

              if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? ENTER_INITIAL : false}
                    animate={ENTER_ANIMATE}
                    transition={ENTER_TRANSITION}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    <TimelinePrEventItem
                      event={item.data}
                      type={item.type}
                      timestamp={item.timestamp}
                    />
                  </motion.div>
                )
              }
              if (item.type === "commit") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? ENTER_INITIAL : false}
                    animate={ENTER_ANIMATE}
                    transition={ENTER_TRANSITION}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    <TimelineCommitItem
                      commit={item.data}
                      checkRuns={CHECK_RUNS}
                      headSha={item.data.sha}
                    />
                  </motion.div>
                )
              }
              if (item.type === "review") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? ENTER_INITIAL : false}
                    animate={ENTER_ANIMATE}
                    transition={ENTER_TRANSITION}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    <TimelineReviewItem review={item.data} />
                  </motion.div>
                )
              }
              if (item.type === "issue_comment") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? ENTER_INITIAL : false}
                    animate={ENTER_ANIMATE}
                    transition={ENTER_TRANSITION}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    <TimelineIssueCommentItem comment={item.data} />
                  </motion.div>
                )
              }
              if (item.type === "review_comment") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? ENTER_INITIAL : false}
                    animate={ENTER_ANIMATE}
                    transition={ENTER_TRANSITION}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    <TimelineReviewCommentItem thread={item.data} />
                  </motion.div>
                )
              }
              return (
                <motion.div
                  key={itemKey}
                  className={styles.timelineItemMotion}
                  initial={shouldAnimateIn ? ENTER_INITIAL : false}
                  animate={ENTER_ANIMATE}
                  transition={ENTER_TRANSITION}
                  onAnimationComplete={handleAnimationComplete}
                >
                  <TimelinePrActionItem event={item.data} />
                </motion.div>
              )
            })}
          </div>
        ) : (
          <p className={styles.emptyState}>
            No items yet. Click &quot;Seed timeline&quot; to start.
          </p>
        )}
      </section>
    </div>
  )
}
