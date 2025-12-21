import { useMemo } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { Row } from "@rocicorp/zero"
import { queries } from "@/db/queries"
import { DiffViewer } from "./DiffViewer"
import type { DiffOptions } from "./DiffOptionsBar"
import styles from "./PRFilesTab.module.css"

interface PRFilesTabProps {
  prId: string
  diffOptions: DiffOptions
}

export const PRFilesTab = ({ prId, diffOptions }: PRFilesTabProps) => {
  const [files] = useQuery(queries.prFiles(prId))
  const [comments] = useQuery(queries.reviewComments(prId))

  // Group comments by path for easy access
  const commentsByPath = useMemo(() => {
    const map = new Map<string, Row["githubPrComment"][]>()
    for (const comment of comments) {
      if (comment.path) {
        const existing = map.get(comment.path) || []
        existing.push(comment)
        map.set(comment.path, existing)
      }
    }
    return map
  }, [comments])

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
  file: Row["githubPrFile"]
  comments: Row["githubPrComment"][]
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
