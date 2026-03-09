import { DiffIcon } from "@primer/octicons-react"
import type { PullRequestCard } from "./Types"
import styles from "./PrDiffStat.module.css"

interface PrDiffStatProps {
  pr: PullRequestCard
}

export const PrDiffStat = ({ pr }: PrDiffStatProps) => {
  const files = pr.pullRequestFiles
  const totalAdditions = files.reduce((sum, f) => sum + (f.additions ?? 0), 0)
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions ?? 0), 0)

  return (
    <span className={styles.diffStat}>
      <DiffIcon size={14} />
      <span>{files.length}</span>
      {Boolean(totalAdditions) && <span className={styles.additions}>+{totalAdditions}</span>}
      {Boolean(totalDeletions) && <span className={styles.deletions}>-{totalDeletions}</span>}
    </span>
  )
}
