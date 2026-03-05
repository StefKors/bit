import { FileIcon } from "@primer/octicons-react"
import { CommitSelector } from "./CommitSelector"
import { FileEntry } from "./FileEntry"
import type { PullRequestCard } from "./Types"
import styles from "./PrFilesChanged.module.css"

interface PrFilesChangedProps {
  pr: PullRequestCard
}

export function PrFilesChanged({ pr }: PrFilesChangedProps) {
  const files = pr.pullRequestFiles
  const hasFiles = files.length > 0

  const totalAdditions = files.reduce((sum, f) => sum + (f.additions ?? 0), 0)
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions ?? 0), 0)

  return (
    <div className={styles.filesChangedContainer}>
      <div className={styles.filesChangedToolbar}>
        <div className={styles.filesChangedStats}>
          <span className={styles.filesCount}>
            <FileIcon size={14} />
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
          {Boolean(totalAdditions) && (
            <span className={styles.additionsStat}>+{totalAdditions}</span>
          )}
          {Boolean(totalDeletions) && (
            <span className={styles.deletionsStat}>-{totalDeletions}</span>
          )}
        </div>
        <CommitSelector commits={pr.pullRequestCommits} selectedSha={pr.headSha ?? ""} />
      </div>

      {!hasFiles && <div className={styles.placeholder}>No file changes available yet.</div>}

      {hasFiles && (
        <div className={styles.filesList}>
          {files.map((file) => (
            <FileEntry key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
