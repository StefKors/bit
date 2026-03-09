import { DiffIcon } from "@primer/octicons-react"
import { db } from "@/lib/InstantDb"
import styles from "./PrDiffStat.module.css"

interface PrDiffStatProps {
  owner: string
  repo: string
  prNumber: number
}

export const PrDiffStat = ({ owner, repo, prNumber }: PrDiffStatProps) => {
  const fullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1, fields: ["fullName"] },
      pullRequests: {
        $: { where: { number: prNumber }, limit: 1, fields: ["number"] },
        pullRequestFiles: {
          $: { fields: ["additions", "deletions"] },
        },
      },
    },
  })

  const files = data?.repos?.[0]?.pullRequests?.[0]?.pullRequestFiles ?? []
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
