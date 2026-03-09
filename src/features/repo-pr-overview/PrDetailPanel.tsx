import { useState } from "react"
import { ScrollArea } from "@base-ui/react/scroll-area"
import { db } from "@/lib/InstantDb"
import { Tabs } from "@/components/Tabs"
import { PrListToolbar } from "./PrListToolbar"
import { SelectedPrHeader } from "./SelectedPrHeader"
import { PrSidebar } from "./PrSidebar"
import { PrDiffStat } from "./PrDiffStat"
import { PrDetailContent } from "./PrDetailContent"
import { PrFilesChanged } from "./PrFilesChanged"
import { PrCommits } from "./PrCommits"
import { mapPrToCard } from "./MapPrToCard"
import styles from "./RepoPrOverviewPage.module.css"

interface PrDetailPanelProps {
  owner: string
  repo: string
  prNumber: number
}

const PR_TABS = [
  { value: "conversation", label: "Conversation" },
  { value: "commits", label: "Commits" },
  { value: "files", label: "Files Changed" },
]

export const PrDetailPanel = ({ owner, repo, prNumber }: PrDetailPanelProps) => {
  const [prTab, setPrTab] = useState("conversation")
  const fullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { where: { number: prNumber }, limit: 1 },
        pullRequestReviews: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
        checkRuns: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
      },
    },
  })

  const rawPr = data?.repos?.[0]?.pullRequests?.[0]
  if (!rawPr) return null

  const pr = mapPrToCard(rawPr)

  return (
    <>
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

      <ScrollArea.Root className={styles.column2}>
        <ScrollArea.Viewport className={styles.column2Viewport}>
          <ScrollArea.Content className={styles.column2Content}>
            {prTab === "conversation" ? (
              <PrDetailContent owner={owner} repo={repo} prNumber={prNumber} />
            ) : prTab === "commits" ? (
              <PrCommits owner={owner} repo={repo} prNumber={prNumber} />
            ) : (
              <PrFilesChanged owner={owner} repo={repo} prNumber={prNumber} />
            )}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.column2Scrollbar}>
          <ScrollArea.Thumb className={styles.column2Thumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </>
  )
}
