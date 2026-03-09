import { Fragment } from "react"
import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import type { PullRequestCard } from "./Types"
import { getPrStatusVariant } from "./Utils"
import styles from "./PrSelectionList.module.css"

type PrStatusVariant = "open" | "merged" | "closed" | "needsReview" | "draft"

const SECTION_ORDER: PrStatusVariant[] = ["draft", "needsReview", "open", "merged", "closed"]

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

  const prsByVariant = new Map<PrStatusVariant, PullRequestCard[]>()
  for (const pr of prs) {
    const { variant } = getPrStatusVariant(pr)
    const list = prsByVariant.get(variant) ?? []
    list.push(pr)
    prsByVariant.set(variant, list)
  }

  return (
    <ul className={styles.prList}>
      {SECTION_ORDER.map((variant) => {
        const sectionPrs = prsByVariant.get(variant) ?? []
        const firstPr = sectionPrs.at(0)
        if (!firstPr) return null

        const sampleStatus = getPrStatusVariant(firstPr)
        return (
          <Fragment key={variant}>
            <li className={styles.prCellSection}>
              <span className={styles.prCellRow1}>
                <span className={styles.prTitle}>
                  <span className={styles.prSectionLabel}>{sampleStatus.label}</span>
                  <span className={styles.prSectionCount}>{sectionPrs.length}</span>
                </span>
              </span>
            </li>
            {sectionPrs.map((pr) => {
              const isSelected = selectedPrNumber === pr.number
              const isNew = newPrIds.has(pr.id)
              const status = getPrStatusVariant(pr)
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
                      <span
                        className={`${styles.prStatusIcon} ${styles[`prStatusIcon${status.variant === "needsReview" ? "NeedsReview" : status.variant.charAt(0).toUpperCase() + status.variant.slice(1)}`]}`}
                        aria-hidden
                      >
                        {status.icon}
                      </span>
                      <span className={styles.prNumber}>#{pr.number}</span>
                      <span className={styles.prTitle}>{pr.title}</span>
                    </span>
                  </Link>
                </motion.li>
              )
            })}
          </Fragment>
        )
      })}
    </ul>
  )
}
