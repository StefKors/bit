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
    <div className={styles.container}>
      <div className={styles.columns}>
        <PrListPanel owner={owner} repo={repo} selectedPrNumber={selectedPrNumber} />
        {selectedPrNumber !== null ? (
          <PrDetailPanel owner={owner} repo={repo} prNumber={selectedPrNumber} />
        ) : (
          <div className={`${styles.column2} ${styles.placeholder}`}>
            Select a PR from the left column.
          </div>
        )}
      </div>
    </div>
  )
}
