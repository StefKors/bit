import { formatMergeableState, formatRelativeTime } from "@/lib/format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { StatusBadge } from "@/components/StatusBadge"
import { BranchLabel } from "@/components/BranchLabel"
import { CiDot } from "@/components/CiDot"
import { getPrStatusVariant, getCiDotVariant } from "./utils"
import type { PullRequestCard } from "./types"
import styles from "./SelectedPRHeader.module.css"

interface SelectedPRHeaderProps {
  pr: PullRequestCard
}

export function SelectedPRHeader({ pr }: SelectedPRHeaderProps) {
  const status = getPrStatusVariant(pr)
  const totalComments = pr.commentsCount + pr.reviewCommentsCount

  return (
    <div className={styles.selectedPrHeader}>
      <span className={styles.selectedPrHeaderTop}>
        <span className={styles.selectedPrHeaderTitle}>
          <span className={styles.selectedPrHeaderNumber}>#{pr.number}</span>
          {pr.title}
        </span>
        <span className={styles.selectedPrHeaderDate}>{formatRelativeTime(pr.updatedAt)}</span>
      </span>

      <span className={styles.selectedPrHeaderBottom}>
        <StatusBadge variant={status.variant} icon={status.icon}>
          {status.label}
        </StatusBadge>
        <AuthorLabel login={pr.authorLogin} avatarUrl={pr.authorAvatarUrl} size={14} />
        <span className={styles.selectedPrHeaderSep} aria-hidden>
          ·
        </span>
        <BranchLabel head={pr.headRef} base={pr.baseRef} />
        {Boolean(totalComments) && (
          <span className={styles.selectedPrHeaderComments}>
            {totalComments} comment{totalComments !== 1 ? "s" : ""}
          </span>
        )}
        <CiDot
          variant={getCiDotVariant(pr)}
          title={pr.merged ? "Merged" : formatMergeableState(pr.mergeableState)}
        />
      </span>
    </div>
  )
}
