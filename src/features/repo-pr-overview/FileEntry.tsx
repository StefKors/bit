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

const buildPatchForViewer = (file: PullRequestFileEntry): string | null => {
  const rawPatch = file.patch?.trim()
  if (!rawPatch) return null

  const diffHeaders = rawPatch.match(/^diff --git /gm) ?? []
  if (diffHeaders.length > 1) return null
  if (diffHeaders.length === 1) return rawPatch

  if (!rawPatch.includes("@@")) return null

  const previousPath = file.previousFilename || file.filename
  const fromPath = file.status === "added" ? "/dev/null" : `a/${previousPath}`
  const toPath = file.status === "removed" ? "/dev/null" : `b/${file.filename}`

  return `diff --git a/${previousPath} b/${file.filename}
--- ${fromPath}
+++ ${toPath}
${rawPatch}`
}

export function FileEntry({ file }: FileEntryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const statusClass = FILE_STATUS_CLASS[file.status] ?? "fileStatusModified"
  const icon = FILE_STATUS_ICON[file.status] ?? <DiffModifiedIcon size={14} />
  const viewerPatch = buildPatchForViewer(file)

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
      {!collapsed && viewerPatch && (
        <div className={styles.diffContainer}>
          <PatchDiff
            patch={viewerPatch}
            options={{
              diffStyle: "unified",
              disableLineNumbers: false,
              overflow: "scroll",
            }}
          />
        </div>
      )}
      {!collapsed && !viewerPatch && (
        <div className={styles.diffPlaceholder}>
          {file.status === "removed" ? "File deleted" : "Binary file or diff too large to display"}
        </div>
      )}
    </div>
  )
}
