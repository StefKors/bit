import { useState, useMemo } from "react"
import { useQuery } from "@rocicorp/zero/react"
import {
  PlusIcon,
  DashIcon,
  FoldIcon,
  UnfoldIcon,
  CommentIcon,
} from "@primer/octicons-react"
import { DiffViewer } from "./DiffViewer"
import { Button } from "./Button"
import { queries } from "@/db/queries"
import styles from "./PRFilesTab.module.css"
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
  const [comments] = useQuery(queries.reviewComments(prId))
  const [allExpanded, setAllExpanded] = useState(true)
  // Used as key to reset expanded state when bulk toggle happens
  const [expandKey, setExpandKey] = useState(0)

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

  const totalComments = comments.length
  const filesWithComments = commentsByPath.size

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
          {totalComments > 0 && (
            <span className={`${styles.filesStat} ${styles.commentsStat}`}>
              <CommentIcon className={styles.filesStatIcon} size={14} />
              {totalComments} comment{totalComments !== 1 ? "s" : ""} on{" "}
              {filesWithComments} file{filesWithComments !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className={styles.filesActions}>
          <Button
            variant="invisible"
            size="small"
            leadingIcon={
              allExpanded ? <FoldIcon size={14} /> : <UnfoldIcon size={14} />
            }
            onClick={() => {
              setAllExpanded(!allExpanded)
              setExpandKey((k) => k + 1)
            }}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
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
            <FileItem
              key={`${file.id}-${expandKey}`}
              file={file}
              comments={commentsByPath.get(file.filename) || []}
              defaultExpanded={allExpanded}
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
  defaultExpanded: boolean
}

const FileItem = ({ file, comments, defaultExpanded }: FileItemProps) => {
  const { filename, previousFilename, patch, additions, deletions, status } =
    file
  return (
    <DiffViewer
      filename={filename}
      previousFilename={previousFilename}
      patch={patch ?? ""}
      additions={additions ?? 0}
      deletions={deletions ?? 0}
      status={status}
      comments={comments}
      defaultExpanded={defaultExpanded}
    />
  )
}
