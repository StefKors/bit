import { Markdown } from "@/components/Markdown"
import { CiDot } from "@/components/CiDot"
import { buildTimeline } from "./utils"
import { TimelineCommitItem } from "./TimelineCommitItem"
import { TimelineReviewItem } from "./TimelineReviewItem"
import { TimelineIssueCommentItem } from "./TimelineIssueCommentItem"
import { TimelineReviewCommentItem } from "./TimelineReviewCommentItem"
import type { PullRequestCard, TimelineItem } from "./types"
import styles from "./PRDetailContent.module.css"

interface PRDetailContentProps {
  pr: PullRequestCard
}

export function PRDetailContent({ pr }: PRDetailContentProps) {
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
      </div>
    </div>
  )
}
