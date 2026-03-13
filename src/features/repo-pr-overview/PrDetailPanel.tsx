import { useEffect, useRef, useState } from "react"
import { db } from "@/lib/InstantDb"
import { Tabs } from "@/components/Tabs"
import { useAuth } from "@/lib/hooks/UseAuth"
import { PrListToolbar } from "./PrListToolbar"
import { SelectedPrHeader } from "./SelectedPrHeader"
import { PrSidebar } from "./PrSidebar"
import { PrDiffStat } from "./PrDiffStat"
import { PrDetailContent } from "./PrDetailContent"
import { PrFilesChanged } from "./PrFilesChanged"
import { PrCommits } from "./PrCommits"
import { PrReviewTab } from "./PrReviewTab"
import { mapPrToCard } from "./MapPrToCard"
import styles from "./RepoPrOverviewPage.module.css"
import { Markdown } from "@/components/Markdown"
import { BranchLabel } from "@/components/BranchLabel"

interface PrDetailPanelProps {
  owner: string
  repo: string
  prNumber: number
}

const PR_TABS = [
  { value: "conversation", label: "Conversation" },
  { value: "review", label: "Review" },
  { value: "commits", label: "Commits" },
  { value: "files", label: "Files Changed" },
]

export const PrDetailPanel = ({ owner, repo, prNumber }: PrDetailPanelProps) => {
  const { user } = useAuth()
  const [prTab, setPrTab] = useState("conversation")
  const lastSeenRequestKeyRef = useRef<string | null>(null)
  const fullName = `${owner}/${repo}`
  const refreshToken = (user as { refresh_token?: string } | null)?.refresh_token

  useEffect(() => {
    if (!refreshToken) return

    const requestKey = `${owner}/${repo}#${prNumber}`
    if (lastSeenRequestKeyRef.current === requestKey) return
    lastSeenRequestKeyRef.current = requestKey

    fetch("/api/github/repos/pr-seen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ owner, repo, number: prNumber }),
    }).catch(() => {})
  }, [owner, prNumber, refreshToken, repo])

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1, fields: ["fullName"] },
      pullRequests: {
        $: {
          where: { number: prNumber },
          limit: 1,
          fields: [
            "number",
            "title",
            "body",
            "state",
            "merged",
            "draft",
            "mergeableState",
            "authorLogin",
            "authorAvatarUrl",
            "headRef",
            "baseRef",
            "headSha",
            "updatedAt",
            "commentsCount",
            "reviewCommentsCount",
            "labels",
            "assignees",
            "requestedReviewers",
            "githubCreatedAt",
            "githubClosedAt",
            "githubMergedAt",
            "mergedByLogin",
            "mergedByAvatarUrl",
            "closedByLogin",
            "closedByAvatarUrl",
          ],
        },
        pullRequestReviews: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
            fields: ["githubId", "state", "authorLogin", "authorAvatarUrl", "updatedAt"],
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
        checkSuites: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
            fields: ["status", "conclusion", "appName", "headSha", "updatedAt"],
          },
        },
        commitStatuses: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
            fields: ["sha", "context", "state", "description", "targetUrl", "updatedAt"],
          },
        },
        workflowRuns: {
          $: {
            order: { updatedAt: "desc" },
            limit: 10,
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
            limit: 20,
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
      },
    },
  })

  const rawPr = data?.repos?.[0]?.pullRequests?.[0]
  if (!rawPr) return null

  const pr = mapPrToCard(rawPr)

  return (
    <div className={styles.column2}>
      <SelectedPrHeader pr={pr} fullName={fullName} />
      <div className={styles.column2Scroll}>
        <div className={styles.bodyContent}>
          {pr.body && <Markdown content={pr.body} className={styles.prDescription} />}

          <div className={styles.prTabs}>
            <Tabs
              items={PR_TABS}
              value={prTab}
              onValueChange={setPrTab}
              trailing={<PrDiffStat owner={owner} repo={repo} prNumber={prNumber} />}
            />
          </div>

          <hr className={styles.prTabsSeparator} />

          {prTab === "conversation" ? (
            <PrDetailContent owner={owner} repo={repo} prNumber={prNumber} />
          ) : prTab === "review" ? (
            <PrReviewTab pr={pr} />
          ) : prTab === "commits" ? (
            <PrCommits owner={owner} repo={repo} prNumber={prNumber} />
          ) : (
            <PrFilesChanged owner={owner} repo={repo} prNumber={prNumber} />
          )}
        </div>
      </div>
    </div>
  )
}
