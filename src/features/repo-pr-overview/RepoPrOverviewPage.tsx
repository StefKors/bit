import { motion } from "motion/react"
import { PrListPanel } from "./PrListPanel"
import { PrDetailPanel } from "./PrDetailPanel"
import styles from "./RepoPrOverviewPage.module.css"

interface RepoPrOverviewPageProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
}

export function RepoPrOverviewPage({ owner, repo, selectedPrNumber }: RepoPrOverviewPageProps) {
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.columns}>
        <PrListPanel owner={owner} repo={repo} selectedPrNumber={selectedPrNumber} />
        {selectedPrNumber !== null && (
          <PrDetailPanel owner={owner} repo={repo} prNumber={selectedPrNumber} />
        )}
        {selectedPrNumber === null && (
          <div className={styles.placeholder}>Select a PR from the left column.</div>
        )}
      </div>
    </motion.div>
  )
}
