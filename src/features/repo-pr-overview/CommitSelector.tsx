import { useState } from "react"
import { ChevronDownIcon, GitCommitIcon } from "@primer/octicons-react"
import type { PullRequestCommit } from "./Types"
import styles from "./CommitSelector.module.css"

interface CommitSelectorProps {
  commits: PullRequestCommit[]
  selectedSha: string
  onSelect: (sha: string) => void
}

export function CommitSelector({ commits, selectedSha, onSelect }: CommitSelectorProps) {
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
              <button
                key={commit.sha}
                type="button"
                className={`${styles.commitDropdownItem} ${isActive ? styles.commitDropdownItemActive : ""}`}
                onClick={() => {
                  onSelect(commit.sha)
                  setOpen(false)
                }}
              >
                <code className={styles.commitShortSha}>{commit.sha.slice(0, 7)}</code>
                <span className={styles.commitMessage}>
                  {commit.messageShort ?? commit.sha.slice(0, 7)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
