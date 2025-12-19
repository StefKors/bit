import { useState } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { PlusIcon, DashIcon } from "@primer/octicons-react"
import { DiffViewer } from "./DiffViewer"
import { queries } from "@/db/queries"
import styles from "./PRFilesTab.module.css"
import { GithubPrFile } from "@/db/schema"
import { Row } from "@rocicorp/zero"

interface PRStats {
  additions: number | null
  deletions: number | null
  changedFiles: number | null
}

interface PRFilesTabProps {
  prId: string
  stats: PRStats
}

export function PRFilesTab({ prId, stats }: PRFilesTabProps) {
  const [files] = useQuery(queries.prFiles(prId))

  return (
    <div className={styles.container}>
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
            <FileItem key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileItemProps {
  file: Row["githubPrFile"]
}

function FileItem({ file }: FileItemProps) {
  const { filename, previousFilename, patch, additions, deletions } = file
  return (
    <DiffViewer
      filename={filename}
      previousFilename={previousFilename}
      patch={patch ?? ""}
      additions={additions ?? 0}
      deletions={deletions ?? 0}
    />
  )
}
