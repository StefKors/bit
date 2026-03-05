import { useState } from "react"
import { ChevronDownIcon, GitCommitIcon } from "@primer/octicons-react"
import type { PullRequestCommit } from "./Types"
import styles from "./CommitSelector.module.css"

interface CommitSelectorProps {
  commits: PullRequestCommit[]
  selectedSha: string
}

export function CommitSelector({ commits, selectedSha }: CommitSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedCommit = commits.find((c) => c.sha === selectedSha)
  const shortSha = selectedSha.slice(0, 7)
  const label = selectedCommit?.messageShort
    ? `${shortSha} ${selectedCommit.messageShort}`
    : shortSha

  return (
    <div className={styles.commitSelector}>
      <button
        type="button"
        className={styles.commitSelectorButton}
        onClick={() => {
          setOpen((prev) => !prev)
        }}
        aria-expanded={open}
        aria-label="Select commit"
      >
        <GitCommitIcon size={14} />
        <span className={styles.commitSelectorLabel}>{label}</span>
        <ChevronDownIcon size={12} />
      </button>
      {open && commits.length > 0 && (
        <div className={styles.commitDropdown}>
          {commits.map((commit) => {
            const isActive = commit.sha === selectedSha
            return (
              <div
                key={commit.sha}
                className={`${styles.commitDropdownItem} ${isActive ? styles.commitDropdownItemActive : ""}`}
              >
                <code className={styles.commitShortSha}>{commit.sha.slice(0, 7)}</code>
                <span className={styles.commitMessage}>
                  {commit.messageShort ?? commit.sha.slice(0, 7)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
