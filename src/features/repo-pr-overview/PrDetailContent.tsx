import { useRef, useState } from "react"
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
import type { PullRequestCard, TimelineItem } from "./Types"
import styles from "./PrDetailContent.module.css"

interface PrDetailContentProps {
  pr: PullRequestCard
  owner: string
  repo: string
}

export function PrDetailContent({ pr, owner, repo }: PrDetailContentProps) {
  const { user } = useAuth()
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const timeline = buildTimeline(pr)

  return (
    <div className={styles.detailContent}>
      {pr.body && <Markdown content={pr.body} className={styles.prBody} />}

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
              if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
                return (
                  <TimelinePrEventItem
                    key={item.type}
                    type={item.type}
                    event={item.data}
                    timestamp={item.timestamp}
                  />
                )
              }
              if (item.type === "commit") {
                return <TimelineCommitItem key={`c-${item.data.id}`} commit={item.data} />
              }
              if (item.type === "review") {
                return <TimelineReviewItem key={`r-${item.data.id}`} review={item.data} />
              }
              if (item.type === "issue_comment") {
                return <TimelineIssueCommentItem key={`ic-${item.data.id}`} comment={item.data} />
              }
              return <TimelineReviewCommentItem key={`rc-${item.data.id}`} comment={item.data} />
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
