import { useState } from "react"
import {
  ChevronDownIcon,
  DiffAddedIcon,
  DiffModifiedIcon,
  DiffRemovedIcon,
  DiffRenamedIcon,
} from "@primer/octicons-react"
import { PatchDiff } from "@pierre/diffs/react"
import type { PullRequestFileEntry } from "./Types"
import styles from "./FileEntry.module.css"

const FILE_STATUS_ICON: Record<string, React.ReactNode> = {
  added: <DiffAddedIcon size={14} />,
  removed: <DiffRemovedIcon size={14} />,
  modified: <DiffModifiedIcon size={14} />,
  renamed: <DiffRenamedIcon size={14} />,
  copied: <DiffRenamedIcon size={14} />,
  changed: <DiffModifiedIcon size={14} />,
}

const FILE_STATUS_CLASS: Record<string, string> = {
  added: "fileStatusAdded",
  removed: "fileStatusRemoved",
  modified: "fileStatusModified",
  renamed: "fileStatusRenamed",
}

interface FileEntryProps {
  file: PullRequestFileEntry
}

export function FileEntry({ file }: FileEntryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const statusClass = FILE_STATUS_CLASS[file.status] ?? "fileStatusModified"
  const icon = FILE_STATUS_ICON[file.status] ?? <DiffModifiedIcon size={14} />

  return (
    <div className={styles.fileEntry}>
      <button
        type="button"
        className={styles.fileHeader}
        onClick={() => {
          setCollapsed((prev) => !prev)
        }}
        aria-expanded={!collapsed}
      >
        <span className={`${styles.fileStatusIcon} ${styles[statusClass] ?? ""}`}>{icon}</span>
        <span className={styles.fileName}>
          {file.previousFilename && file.previousFilename !== file.filename && (
            <span className={styles.previousFileName}>{file.previousFilename} → </span>
          )}
          {file.filename}
        </span>
        <span className={styles.fileStats}>
          {(file.additions ?? 0) > 0 && (
            <span className={styles.additionsStat}>+{file.additions}</span>
          )}
          {(file.deletions ?? 0) > 0 && (
            <span className={styles.deletionsStat}>-{file.deletions}</span>
          )}
        </span>
        <ChevronDownIcon
          size={12}
          className={collapsed ? styles.chevronCollapsed : styles.chevronExpanded}
        />
      </button>
      {!collapsed && file.patch && (
        <div className={styles.diffContainer}>
          <PatchDiff
            patch={file.patch}
            options={{
              diffStyle: "unified",
              disableLineNumbers: false,
              overflow: "scroll",
            }}
          />
        </div>
      )}
      {!collapsed && !file.patch && (
        <div className={styles.diffPlaceholder}>
          {file.status === "removed" ? "File deleted" : "Binary file or diff too large to display"}
        </div>
      )}
    </div>
  )
}
