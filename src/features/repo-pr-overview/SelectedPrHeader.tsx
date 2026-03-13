import {
  CopyIcon,
  GitBranchCheckIcon,
  GitBranchIcon,
  LinkExternalIcon,
  LogoGistIcon,
  LogoGithubIcon,
  MarkGithubIcon,
} from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { StatusIcon } from "@/components/StatusIcon"
import { BranchLabel } from "@/components/BranchLabel"
import { getPrStatusVariant } from "./Utils"
import type { PullRequestCard } from "./Types"
import styles from "./SelectedPrHeader.module.css"
import { useState } from "react"

interface SelectedPrHeaderProps {
  pr: PullRequestCard
  fullName: string
}

export function SelectedPrHeader({ pr, fullName }: SelectedPrHeaderProps) {
  const prUrl = `https://github.com/${fullName}/pull/${pr.number}`
  const status = getPrStatusVariant(pr)

  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void navigator.clipboard.writeText(pr.baseRef)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <div className={styles.selectedPrHeader}>
      <div className={styles.selectedPrHeaderTop}>
        <StatusIcon variant={status.variant} icon={status.icon} label={status.label} />
        <span className={styles.selectedPrHeaderTitle}>
          <span className={styles.selectedPrHeaderNumber}>#{pr.number}</span>
          {pr.title}
        </span>

        <div className={styles.group}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleCopy}
            aria-label="Copy branch name"
            title="Copy branch name"
          >
            {copied ? <GitBranchIcon size={12} /> : <CopyIcon size={12} />}
            <span className={styles.actionButtonLabel}>Copy Branch</span>
          </button>

          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionButton}
            title="Open PR on GitHub"
          >
            <MarkGithubIcon size={12} />
            <span className={styles.actionButtonLabel}>Open PR</span>
          </a>
        </div>
      </div>
    </div>
  )
}
