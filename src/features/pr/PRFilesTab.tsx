import { useMemo } from "react"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"
import { DiffViewer } from "./DiffViewer"
import type { DiffOptions } from "./DiffOptionsBar"
import styles from "./PRFilesTab.module.css"

type PrFile = InstaQLEntity<AppSchema, "prFiles">
type PrComment = InstaQLEntity<AppSchema, "prComments">

interface PRFilesTabProps {
  files: readonly PrFile[]
  comments: readonly PrComment[]
  diffOptions: DiffOptions
}

export const PRFilesTab = ({ files, comments, diffOptions }: PRFilesTabProps) => {
  // Filter to only review comments (inline diff comments)
  const reviewComments = useMemo(
    () => comments.filter((c) => c.commentType === "review_comment"),
    [comments],
  )

  // Group comments by path for easy access
  const commentsByPath = useMemo(() => {
    const map = new Map<string, PrComment[]>()
    for (const comment of reviewComments) {
      if (comment.path) {
        const existing = map.get(comment.path) || []
        existing.push(comment)
        map.set(comment.path, existing)
      }
    }
    return map
  }, [reviewComments])

  return (
    <div className={styles.container}>
      {files.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No files synced yet. Click "Sync Details" to fetch file changes.
          </p>
        </div>
      ) : (
        <div className={styles.filesList}>
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              comments={commentsByPath.get(file.filename) || []}
              diffOptions={diffOptions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileItemProps {
  file: PrFile
  comments: PrComment[]
  diffOptions: DiffOptions
}

const FileItem = ({ file, comments, diffOptions }: FileItemProps) => {
  const { filename, previousFilename, patch } = file
  return (
    <DiffViewer
      filename={filename}
      previousFilename={previousFilename}
      patch={patch ?? ""}
      comments={comments}
      diffOptions={diffOptions}
    />
  )
}
