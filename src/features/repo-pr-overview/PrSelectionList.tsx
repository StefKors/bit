import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import type { PullRequestCard } from "./Types"
import styles from "./PrSelectionList.module.css"

interface PrSelectionListProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
  prs: PullRequestCard[]
  newPrIds: Set<string>
}

export function PrSelectionList({
  owner,
  repo,
  selectedPrNumber,
  prs,
  newPrIds,
}: PrSelectionListProps) {
  if (prs.length === 0) {
    return <p className={styles.empty}>No pull requests match the current filters.</p>
  }

  return (
    <ul className={styles.prList}>
      {prs.map((pr) => {
        const isSelected = selectedPrNumber === pr.number
        const isNew = newPrIds.has(pr.id)
        return (
          <motion.li
            key={pr.id}
            initial={isNew ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to="/$owner/$repo/$prNumber"
              params={{ owner, repo, prNumber: String(pr.number) }}
              preload="intent"
              className={`${styles.prCell} ${isSelected ? styles.prCellSelected : ""}`}
              aria-current={isSelected ? "true" : undefined}
            >
              <span className={styles.prCellRow1}>
                <span className={styles.prNumber}>#{pr.number}</span>
                <span className={styles.prTitle}>{pr.title}</span>
              </span>
              {/* <span className={styles.prCellRow2}>
                <AuthorLabel
                  login={pr.authorLogin}
                  avatarUrl={pr.authorAvatarUrl}
                  size={12}
                  weight="regular"
                />
                <span className={styles.prMetaTrail}>
                  <span className={styles.prUpdatedAt}>{formatRelativeTime(pr.updatedAt)}</span>
                  <CiDot
                    variant={getCiDotVariant(pr)}
                    title={pr.merged ? "Merged" : formatMergeableState(pr.mergeableState)}
                  />
                </span>
              </span> */}
            </Link>
          </motion.li>
        )
      })}
    </ul>
  )
}
