import { useState } from "react"
import { db } from "@/lib/InstantDb"
import { Tabs } from "@/components/Tabs"
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
  const [prTab, setPrTab] = useState("conversation")
  const fullName = `${owner}/${repo}`

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
            fields: ["name", "status", "conclusion", "detailsUrl", "htmlUrl", "updatedAt"],
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
            fields: ["context", "state", "description", "targetUrl", "updatedAt"],
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
              "updatedAt",
            ],
          },
        },
        workflowJobs: {
          $: {
            order: { updatedAt: "desc" },
            limit: 20,
            fields: ["runId", "name", "status", "conclusion", "htmlUrl", "runUrl", "updatedAt"],
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
      <div className={styles.prHeader}>
        <SelectedPrHeader pr={pr} fullName={fullName} />
        <PrSidebar pr={pr} />
      </div>

      <PrListToolbar className={styles.prTabs}>
        <Tabs
          items={PR_TABS}
          value={prTab}
          onValueChange={setPrTab}
          trailing={<PrDiffStat owner={owner} repo={repo} prNumber={prNumber} />}
        />
      </PrListToolbar>

      <hr className={styles.prTabsSeparator} />

      <div className={styles.column2Scroll}>
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
  )
}
