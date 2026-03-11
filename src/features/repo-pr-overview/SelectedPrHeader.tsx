import { LinkExternalIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { StatusBadge } from "@/components/StatusBadge"
import { BranchLabel } from "@/components/BranchLabel"
import { getPrStatusVariant } from "./Utils"
import type { PullRequestCard } from "./Types"
import styles from "./SelectedPrHeader.module.css"

interface SelectedPrHeaderProps {
  pr: PullRequestCard
  fullName: string
}

export function SelectedPrHeader({ pr, fullName }: SelectedPrHeaderProps) {
  const prUrl = `https://github.com/${fullName}/pull/${pr.number}`
  const status = getPrStatusVariant(pr)

  return (
    <div className={styles.selectedPrHeader}>
      <span className={styles.selectedPrHeaderTop}>
        <span className={styles.selectedPrHeaderTitle}>
          <span className={styles.selectedPrHeaderNumber}>#{pr.number}</span>
          {pr.title}
        </span>
        <span className={styles.selectedPrHeaderDate}>{formatRelativeTime(pr.updatedAt)}</span>
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.selectedPrHeaderGitHubLink}
          title="Open PR on GitHub"
        >
          <LinkExternalIcon size={12} />
        </a>
      </span>

      <span className={styles.selectedPrHeaderBottom}>
        <StatusBadge variant={status.variant} icon={status.icon}>
          {status.label}
        </StatusBadge>
        <BranchLabel head={pr.headRef} base={pr.baseRef} />
      </span>
    </div>
  )
}
