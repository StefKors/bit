import { useRef, useState } from "react"
import { db } from "@/lib/InstantDb"
import { Markdown } from "@/components/Markdown"
import { Button } from "@/components/Button"
import { useAuth } from "@/lib/hooks/UseAuth"
import { buildTimeline } from "./Utils"
import { Timeline } from "./Timeline"
import { getTimelineItemKey } from "./TimelineUtils"
import { mapPrToCard } from "./MapPrToCard"
import { PrReviewTab } from "./PrReviewTab"
import styles from "./PrDetailContent.module.css"

interface PrDetailContentProps {
  owner: string
  repo: string
  prNumber: number
}

export function PrDetailContent({ owner, repo, prNumber }: PrDetailContentProps) {
  const { user } = useAuth()
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fullName = `${owner}/${repo}`
  const viewerUserId = user?.id ?? "__anonymous__"

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1, fields: ["fullName"] },
      pullRequests: {
        $: {
          where: { number: prNumber },
          limit: 1,
          fields: [
            "body",
            "state",
            "merged",
            "headSha",
            "activityUpdatedAt",
            "authorLogin",
            "authorAvatarUrl",
            "githubCreatedAt",
            "githubClosedAt",
            "githubMergedAt",
            "mergedByLogin",
            "mergedByAvatarUrl",
            "closedByLogin",
            "closedByAvatarUrl",
          ],
        },
        pullRequestViews: {
          $: {
            where: { userId: viewerUserId },
            limit: 1,
            fields: ["lastSeenAt", "updatedAt"],
          },
        },
        issueComments: {
          $: {
            order: { updatedAt: "desc" },
            limit: 20,
            fields: [
              "githubId",
              "authorLogin",
              "authorAvatarUrl",
              "body",
              "htmlUrl",
              "createdAt",
              "updatedAt",
            ],
          },
        },
        pullRequestReviews: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
            fields: [
              "githubId",
              "authorLogin",
              "authorAvatarUrl",
              "state",
              "body",
              "htmlUrl",
              "submittedAt",
              "updatedAt",
            ],
          },
        },
        pullRequestReviewComments: {
          $: {
            order: { updatedAt: "desc" },
            limit: 20,
            fields: [
              "githubId",
              "nodeId",
              "inReplyToId",
              "pullRequestReviewId",
              "payload",
              "authorLogin",
              "authorAvatarUrl",
              "body",
              "path",
              "line",
              "htmlUrl",
              "createdAt",
              "updatedAt",
            ],
          },
        },
        pullRequestReviewThreads: {
          $: {
            order: { updatedAt: "desc" },
            limit: 50,
            fields: ["threadId", "resolved", "payload", "createdAt", "updatedAt"],
          },
        },
        pullRequestCommits: {
          $: {
            order: { updatedAt: "desc" },
            limit: 50,
            fields: [
              "sha",
              "message",
              "messageShort",
              "authorLogin",
              "authorAvatarUrl",
              "authoredAt",
              "createdAt",
              "htmlUrl",
            ],
          },
        },
        checkRuns: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
            fields: [
              "name",
              "status",
              "conclusion",
              "detailsUrl",
              "htmlUrl",
              "headSha",
              "updatedAt",
            ],
          },
        },
        commitStatuses: {
          $: {
            order: { updatedAt: "desc" },
            limit: 20,
            fields: ["sha", "context", "state", "description", "targetUrl", "updatedAt"],
          },
        },
        workflowRuns: {
          $: {
            order: { updatedAt: "desc" },
            limit: 20,
            fields: [
              "githubId",
              "name",
              "status",
              "conclusion",
              "htmlUrl",
              "runNumber",
              "runAttempt",
              "headSha",
              "updatedAt",
            ],
          },
        },
        workflowJobs: {
          $: {
            order: { updatedAt: "desc" },
            limit: 40,
            fields: [
              "runId",
              "name",
              "status",
              "conclusion",
              "htmlUrl",
              "runUrl",
              "headSha",
              "updatedAt",
            ],
          },
        },
        pullRequestEvents: {
          $: {
            order: { updatedAt: "desc" },
            limit: 50,
            fields: [
              "eventType",
              "actorLogin",
              "actorAvatarUrl",
              "targetLogin",
              "targetAvatarUrl",
              "label",
              "githubCreatedAt",
            ],
          },
        },
      },
    },
  })

  const rawPr = data?.repos?.[0]?.pullRequests?.[0]
  const pr = rawPr ? mapPrToCard(rawPr) : null

  const timeline = pr ? buildTimeline(pr) : []
  const activePrIdRef = useRef(pr?.id)
  const latchedTimelineCutoffRef = useRef<number | null>(null)
  const hasInitiallyLoadedTimelineRef = useRef(false)
  const prevTimelineItemIdsRef = useRef(new Set<string>())

  if (pr && activePrIdRef.current !== pr.id) {
    activePrIdRef.current = pr.id
    latchedTimelineCutoffRef.current =
      typeof pr.lastSeenAt === "number" && pr.lastSeenAt > 0 ? pr.lastSeenAt : null
    hasInitiallyLoadedTimelineRef.current = false
    prevTimelineItemIdsRef.current = new Set<string>()
  }

  const currentTimelineItemIds = new Set(timeline.map(getTimelineItemKey))
  if (!hasInitiallyLoadedTimelineRef.current && pr) {
    hasInitiallyLoadedTimelineRef.current = true
    prevTimelineItemIdsRef.current = new Set(currentTimelineItemIds)
  }

  const newTimelineItemIds = new Set(
    [...currentTimelineItemIds].filter((id) => !prevTimelineItemIdsRef.current.has(id)),
  )
  prevTimelineItemIdsRef.current = currentTimelineItemIds

  if (!pr) return null

  return (
    <div className={styles.detailContent}>
      {pr.body && <Markdown content={pr.body} />}

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Activity</h3>
        {timeline.length > 0 ? (
          <Timeline
            items={timeline}
            className={styles.timeline}
            itemMotionClassName={styles.timelineItemMotion}
            checkRuns={pr.checkRuns}
            headSha={pr.headSha}
            animatedItemKeys={newTimelineItemIds}
            newChangesSinceTimestamp={latchedTimelineCutoffRef.current}
          />
        ) : (
          <p className={styles.detailEmpty}>No activity yet.</p>
        )}

        <PrReviewTab pr={pr} compact />

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
                  number: prNumber,
                  body,
                }),
              })
                .then(async (res) => {
                  const respData = (await res.json()) as { htmlUrl?: string; error?: string }
                  if (!res.ok) throw new Error(respData.error ?? "Failed to post comment")
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
