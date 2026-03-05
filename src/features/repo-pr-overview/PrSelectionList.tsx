import { useState } from "react"
import {
  GitMergeIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  SyncIcon,
} from "@primer/octicons-react"
import { PrSelectionSection } from "./PrSelectionSection"
import type { PullRequestCard } from "./Types"
import styles from "./PrSelectionList.module.css"

interface PrSelectionListProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
  draftPRs: PullRequestCard[]
  needsReviewPRs: PullRequestCard[]
  readyToMergePRs: PullRequestCard[]
  mergedPRs: PullRequestCard[]
  newPrIds: Set<string>
}

export function PrSelectionList({
  owner,
  repo,
  selectedPrNumber,
  draftPRs,
  needsReviewPRs,
  readyToMergePRs,
  mergedPRs,
  newPrIds,
}: PrSelectionListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    draft: true,
    needsReview: true,
    readyToMerge: true,
    merged: false,
  })

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className={styles.prSectionList}>
      <PrSelectionSection
        owner={owner}
        repo={repo}
        sectionId="draft"
        title="Draft"
        icon={<GitPullRequestDraftIcon size={12} />}
        prs={draftPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.draft}
        onToggle={() => {
          toggleSection("draft")
        }}
        newPrIds={newPrIds}
      />
      <PrSelectionSection
        owner={owner}
        repo={repo}
        sectionId="needsReview"
        title="Needs Review"
        icon={<SyncIcon size={12} />}
        prs={needsReviewPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.needsReview}
        onToggle={() => {
          toggleSection("needsReview")
        }}
        newPrIds={newPrIds}
      />
      <PrSelectionSection
        owner={owner}
        repo={repo}
        sectionId="readyToMerge"
        title="Ready to Merge"
        icon={<GitPullRequestIcon size={12} />}
        prs={readyToMergePRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.readyToMerge}
        onToggle={() => {
          toggleSection("readyToMerge")
        }}
        newPrIds={newPrIds}
      />
      <PrSelectionSection
        owner={owner}
        repo={repo}
        sectionId="merged"
        title="Merged"
        icon={<GitMergeIcon size={12} />}
        prs={mergedPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.merged}
        onToggle={() => {
          toggleSection("merged")
        }}
        newPrIds={newPrIds}
      />
    </div>
  )
}
