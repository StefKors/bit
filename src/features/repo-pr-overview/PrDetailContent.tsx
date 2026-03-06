import { useRef, useState } from "react"
import { motion } from "motion/react"
import { Markdown } from "@/components/Markdown"
import { CiDot } from "@/components/CiDot"
import { Button } from "@/components/Button"
import { useAuth } from "@/lib/hooks/UseAuth"
import { buildTimeline } from "./Utils"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineReviewItem } from "./TimelineReviewItem"
import { TimelineIssueCommentItem } from "./TimelineIssueCommentItem"
import { TimelineReviewCommentItem } from "./TimelineReviewCommentItem"
import { TimelinePrEventItem } from "./TimelinePrEventItem"
import { TimelinePrActionItem } from "./TimelinePrActionItem"
import type { PullRequestCard, TimelineItem } from "./Types"
import styles from "./PrDetailContent.module.css"

interface PrDetailContentProps {
  pr: PullRequestCard
  owner: string
  repo: string
}

const TIMELINE_ENTER_INITIAL = { opacity: 0, y: 14 }
const TIMELINE_ENTER_ANIMATE = { opacity: 1, y: 0 }
const TIMELINE_ENTER_TRANSITION = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const }

const getTimelineItemKey = (item: TimelineItem): string => {
  if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
    return `${item.type}-${item.timestamp}`
  }
  if (item.type === "pr_event") return `pe-${item.data.id}`
  if (item.type === "commit") return `c-${item.data.id}`
  if (item.type === "review") return `r-${item.data.id}`
  if (item.type === "issue_comment") return `ic-${item.data.id}`
  return `rc-${item.data.root.id}`
}

export function PrDetailContent({ pr, owner, repo }: PrDetailContentProps) {
  const { user } = useAuth()
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const timeline = buildTimeline(pr)
  const activePrIdRef = useRef(pr.id)
  const hasInitiallyLoadedTimelineRef = useRef(false)
  const prevTimelineItemIdsRef = useRef(new Set<string>())

  if (activePrIdRef.current !== pr.id) {
    activePrIdRef.current = pr.id
    hasInitiallyLoadedTimelineRef.current = false
    prevTimelineItemIdsRef.current = new Set<string>()
  }

  const currentTimelineItemIds = new Set(timeline.map(getTimelineItemKey))
  if (!hasInitiallyLoadedTimelineRef.current) {
    hasInitiallyLoadedTimelineRef.current = true
    prevTimelineItemIdsRef.current = new Set(currentTimelineItemIds)
  }

  const newTimelineItemIds = new Set(
    [...currentTimelineItemIds].filter((id) => !prevTimelineItemIdsRef.current.has(id)),
  )
  prevTimelineItemIdsRef.current = currentTimelineItemIds

  return (
    <div className={styles.detailContent}>
      {pr.body && <Markdown content={pr.body} />}

      {pr.checkRuns.length > 0 && (
        <div className={styles.detailSection}>
          <h3 className={styles.detailSectionTitle}>Checks</h3>
          <ul className={styles.detailList}>
            {pr.checkRuns.map((check) => (
              <li key={check.id} className={styles.detailListItem}>
                <CiDot
                  variant={
                    check.conclusion === "success"
                      ? "ready"
                      : check.conclusion === "failure"
                        ? "blocked"
                        : "checking"
                  }
                />
                <span className={styles.detailListItemText}>{check.name}</span>
                <span className={styles.detailListItemMeta}>
                  {check.conclusion ?? check.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Activity</h3>
        {timeline.length > 0 ? (
          <div className={styles.timeline}>
            {timeline.map((item: TimelineItem) => {
              const itemKey = getTimelineItemKey(item)
              const shouldAnimateIn = newTimelineItemIds.has(itemKey)

              if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                    animate={TIMELINE_ENTER_ANIMATE}
                    transition={TIMELINE_ENTER_TRANSITION}
                  >
                    <TimelinePrEventItem
                      type={item.type}
                      event={item.data}
                      timestamp={item.timestamp}
                    />
                  </motion.div>
                )
              }
              if (item.type === "pr_event") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                    animate={TIMELINE_ENTER_ANIMATE}
                    transition={TIMELINE_ENTER_TRANSITION}
                  >
                    <TimelinePrActionItem event={item.data} />
                  </motion.div>
                )
              }
              if (item.type === "commit") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                    animate={TIMELINE_ENTER_ANIMATE}
                    transition={TIMELINE_ENTER_TRANSITION}
                  >
                    <TimelineCommitItem
                      commit={item.data}
                      checkRuns={pr.checkRuns}
                      headSha={pr.headSha}
                    />
                  </motion.div>
                )
              }
              if (item.type === "review") {
                return (
                  <motion.div
                    key={itemKey}
                    className={styles.timelineItemMotion}
                    initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                    animate={TIMELINE_ENTER_ANIMATE}
                    transition={TIMELINE_ENTER_TRANSITION}
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
                    initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                    animate={TIMELINE_ENTER_ANIMATE}
                    transition={TIMELINE_ENTER_TRANSITION}
                  >
                    <TimelineIssueCommentItem comment={item.data} />
                  </motion.div>
                )
              }
              return (
                <motion.div
                  key={itemKey}
                  className={styles.timelineItemMotion}
                  initial={shouldAnimateIn ? TIMELINE_ENTER_INITIAL : false}
                  animate={TIMELINE_ENTER_ANIMATE}
                  transition={TIMELINE_ENTER_TRANSITION}
                >
                  <TimelineReviewCommentItem thread={item.data} />
                </motion.div>
              )
            })}
          </div>
        ) : (
          <p className={styles.detailEmpty}>No activity yet.</p>
        )}

        {user && (user as { refresh_token?: string }).refresh_token && (
          <form
            className={styles.commentForm}
            onSubmit={(e) => {
              e.preventDefault()
              const textarea = commentRef.current
              const body = textarea?.value?.trim()
              if (!body || submitting) return
              setSubmitError(null)
              setSubmitting(true)
              const token = (user as { refresh_token?: string }).refresh_token
              fetch("/api/github/repos/comment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  owner,
                  repo,
                  number: pr.number,
                  body,
                }),
              })
                .then(async (res) => {
                  const data = (await res.json()) as { htmlUrl?: string; error?: string }
                  if (!res.ok) throw new Error(data.error ?? "Failed to post comment")
                  if (textarea) textarea.value = ""
                })
                .catch((err) => {
                  setSubmitError(err instanceof Error ? err.message : "Failed to post comment")
                })
                .finally(() => {
                  setSubmitting(false)
                })
            }}
          >
            <textarea
              ref={commentRef}
              className={styles.commentTextarea}
              placeholder="Add a comment..."
              rows={4}
              disabled={submitting}
              aria-label="Comment"
              spellCheck={false}
              autoComplete="off"
            />
            <div className={styles.commentActions}>
              <Button type="submit" variant="primary" size="small" loading={submitting}>
                Comment
              </Button>
              {submitError && <span className={styles.commentError}>{submitError}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
