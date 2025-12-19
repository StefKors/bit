import { useState } from "react"
import { PlusIcon, DashIcon } from "@primer/octicons-react"
import { DiffViewer } from "./DiffViewer"
import styles from "./PRFilesTab.module.css"

export interface PRFile {
  id: string
  filename: string
  previousFilename: string | null
  status: string | null
  additions: number | null
  deletions: number | null
  patch: string | null
}

interface PRStats {
  additions: number | null
  deletions: number | null
  changedFiles: number | null
}

interface PRFilesTabProps {
  files: PRFile[]
  stats: PRStats
}

export function PRFilesTab({ files, stats }: PRFilesTabProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  return (
    <>
      <div className={styles.filesHeader}>
        <div className={styles.filesStats}>
          <span className={`${styles.filesStat} ${styles.additionsStat}`}>
            <PlusIcon className={styles.filesStatIcon} size={16} />
            {stats.additions ?? 0} additions
          </span>
          <span className={`${styles.filesStat} ${styles.deletionsStat}`}>
            <DashIcon className={styles.filesStatIcon} size={16} />
            {stats.deletions ?? 0} deletions
          </span>
          <span className={styles.filesStat}>
            {stats.changedFiles ?? 0} files changed
          </span>
        </div>
      </div>

      {files.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No files synced yet. Click "Sync Details" to fetch file changes.
          </p>
        </div>
      ) : (
        <div className={styles.filesList}>
          {files.map((file) => (
            <div key={file.id}>
              <div
                className={styles.fileItem}
                onClick={() =>
                  setExpandedFile(expandedFile === file.id ? null : file.id)
                }
              >
                <FileStatusBadge status={file.status} />
                <span className={styles.fileName}>
                  {file.previousFilename
                    ? `${file.previousFilename} → ${file.filename}`
                    : file.filename}
                </span>
                <div className={styles.fileDiff}>
                  <span className={styles.fileAdditions}>
                    +{file.additions ?? 0}
                  </span>
                  <span className={styles.fileDeletions}>
                    -{file.deletions ?? 0}
                  </span>
                </div>
              </div>
              {expandedFile === file.id && file.patch && (
                <DiffViewer
                  filename={file.filename}
                  patch={file.patch}
                  additions={file.additions ?? 0}
                  deletions={file.deletions ?? 0}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function FileStatusBadge({ status }: { status: string | null }) {
  const getClassName = () => {
    switch (status) {
      case "added":
        return styles.fileStatusAdded
      case "removed":
        return styles.fileStatusRemoved
      case "renamed":
        return styles.fileStatusRenamed
      default:
        return styles.fileStatusModified
    }
  }

  const getLabel = () => {
    switch (status) {
      case "added":
        return "A"
      case "removed":
        return "D"
      case "renamed":
        return "R"
      default:
        return "M"
    }
  }

  return (
    <span className={`${styles.fileStatus} ${getClassName()}`}>
      {getLabel()}
    </span>
  )
}
