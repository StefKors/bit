import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { formatRelativeTime } from "@/lib/Format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { CiDot } from "@/components/CiDot"
import { formatMergeableState } from "@/lib/Format"
import { getCiDotVariant } from "./Utils"
import type { PullRequestCard } from "./Types"
import styles from "./PrSelectionSection.module.css"

interface PrSelectionSectionProps {
  owner: string
  repo: string
  sectionId: string
  title: string
  icon: React.ReactNode
  prs: PullRequestCard[]
  selectedPrNumber: number | null
  isExpanded: boolean
  onToggle: () => void
  newPrIds: Set<string>
}

export function PrSelectionSection({
  owner,
  repo,
  sectionId,
  title,
  icon,
  prs,
  selectedPrNumber,
  isExpanded,
  onToggle,
  newPrIds,
}: PrSelectionSectionProps) {
  return (
    <section className={styles.prSection} data-section={sectionId} data-expanded={isExpanded}>
      <h3 className={styles.prSectionTitle}>
        <button
          type="button"
          className={styles.prSectionTitleButton}
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          <span className={styles.prSectionTitleIcon}>{icon}</span>
          {title}
          <span className={styles.prMetaBadge}>{prs.length}</span>
        </button>
      </h3>
      {isExpanded && prs.length > 0 && (
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
                  to="/$owner/$repo"
                  params={{ owner, repo }}
                  search={(prev) => ({
                    ...prev,
                    selectedPrNumber: String(pr.number),
                  })}
                  preload="intent"
                  className={`${styles.prCell} ${isSelected ? styles.prCellSelected : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span className={styles.prCellRow1}>
                    <span className={styles.prTitle}>
                      #{pr.number} {pr.title}
                    </span>
                    <span className={styles.prUpdatedAt}>{formatRelativeTime(pr.updatedAt)}</span>
                  </span>
                  <span className={styles.prCellRow2}>
                    <AuthorLabel login={pr.authorLogin} avatarUrl={pr.authorAvatarUrl} />
                    <span className={styles.prMetaTrail}>
                      {pr.commentsCount + pr.reviewCommentsCount}
                      <CiDot
                        variant={getCiDotVariant(pr)}
                        title={pr.merged ? "Merged" : formatMergeableState(pr.mergeableState)}
                      />
                    </span>
                  </span>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
