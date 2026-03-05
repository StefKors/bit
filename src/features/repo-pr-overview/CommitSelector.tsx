import { useState } from "react"
import { ChevronDownIcon, GitCommitIcon } from "@primer/octicons-react"
import styles from "./CommitSelector.module.css"

interface CommitInfo {
  sha: string
  message: string
}

interface CommitSelectorProps {
  commits: CommitInfo[]
  selectedSha: string
  onSelect: (sha: string) => void
  loading: boolean
}

export function CommitSelector({ commits, selectedSha, onSelect, loading }: CommitSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedCommit = commits.find((c) => c.sha === selectedSha)
  const shortSha = selectedSha.slice(0, 7)
  const label = selectedCommit
    ? `${shortSha} ${selectedCommit.message.split("\n")[0]?.slice(0, 50) ?? ""}`
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
        disabled={loading}
      >
        <GitCommitIcon size={14} />
        <span className={styles.commitSelectorLabel}>{loading ? "Loading commits…" : label}</span>
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
                  {commit.message.split("\n")[0]?.slice(0, 60) ?? ""}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
