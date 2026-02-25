import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"
import { DiffViewer } from "./DiffViewer"
import type { DiffOptions } from "./DiffOptionsBar"
import styles from "./PRFilesTab.module.css"
import {
  buildViewedFilesKey,
  readViewedFilesFromLocalStorage,
  toggleViewedFile,
  writeViewedFilesToLocalStorage,
} from "@/lib/pr-viewed-files"
import { toggleFileViewedMutation } from "@/lib/mutations"

type PrFile = InstaQLEntity<AppSchema, "prFiles">
type PrComment = InstaQLEntity<AppSchema, "prComments">

interface PRFilesTabProps {
  files: readonly PrFile[]
  comments: readonly PrComment[]
  diffOptions: DiffOptions
  userId?: string
  owner?: string
  repo?: string
  prNumber?: number
  headSha?: string
  onCommentCreated?: () => void
}

export const PRFilesTab = ({
  files,
  comments,
  diffOptions,
  userId,
  owner,
  repo,
  prNumber,
  headSha,
  onCommentCreated,
}: PRFilesTabProps) => {
  const viewedStorageKey =
    owner && repo && prNumber ? buildViewedFilesKey(owner, repo, prNumber) : null
  const canSyncViewedRemotely = Boolean(userId && owner && repo && prNumber)
  const [showOnlyUnviewed, setShowOnlyUnviewed] = useState(false)
  const [viewedPaths, setViewedPaths] = useState<string[]>(
    viewedStorageKey ? readViewedFilesFromLocalStorage(viewedStorageKey) : [],
  )
  const toggleViewedMutation = useMutation(
    toggleFileViewedMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )

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

  const viewedSet = useMemo(() => new Set(viewedPaths), [viewedPaths])
  const viewedCount = useMemo(
    () => files.reduce((count, file) => (viewedSet.has(file.filename) ? count + 1 : count), 0),
    [files, viewedSet],
  )
  const visibleFiles = useMemo(
    () => (showOnlyUnviewed ? files.filter((file) => !viewedSet.has(file.filename)) : files),
    [files, showOnlyUnviewed, viewedSet],
  )

  const handleToggleViewed = (path: string, viewed: boolean) => {
    setViewedPaths((current) => {
      const next = toggleViewedFile(current, path, viewed)
      if (viewedStorageKey) {
        writeViewedFilesToLocalStorage(viewedStorageKey, next)
      }
      return next
    })

    if (canSyncViewedRemotely) {
      toggleViewedMutation.mutate({ path, viewed })
    }
  }

  return (
    <div className={styles.container}>
      {files.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No files synced yet. Files sync automatically when you open this tab.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.viewedHeader}>
            <span className={styles.viewedProgress}>
              {viewedCount} of {files.length} files viewed
            </span>
            <label className={styles.unviewedFilter}>
              <input
                type="checkbox"
                checked={showOnlyUnviewed}
                onChange={(event) => setShowOnlyUnviewed(event.target.checked)}
              />
              Show only unviewed
            </label>
          </div>
          {visibleFiles.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>All files are marked as viewed.</p>
            </div>
          ) : (
            <div className={styles.filesList}>
              {visibleFiles.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  comments={commentsByPath.get(file.filename) || []}
                  diffOptions={diffOptions}
                  userId={userId}
                  owner={owner}
                  repo={repo}
                  prNumber={prNumber}
                  headSha={headSha}
                  onCommentCreated={onCommentCreated}
                  isViewed={viewedSet.has(file.filename)}
                  onToggleViewed={(viewed) => handleToggleViewed(file.filename, viewed)}
                  viewedToggleDisabled={toggleViewedMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface FileItemProps {
  file: PrFile
  comments: PrComment[]
  diffOptions: DiffOptions
  userId?: string
  owner?: string
  repo?: string
  prNumber?: number
  headSha?: string
  onCommentCreated?: () => void
  isViewed: boolean
  onToggleViewed: (viewed: boolean) => void
  viewedToggleDisabled: boolean
}

const FileItem = ({
  file,
  comments,
  diffOptions,
  userId,
  owner,
  repo,
  prNumber,
  headSha,
  onCommentCreated,
  isViewed,
  onToggleViewed,
  viewedToggleDisabled,
}: FileItemProps) => {
  const { filename, previousFilename, patch } = file
  return (
    <div className={styles.fileCard}>
      <label className={styles.viewedToggle}>
        <input
          type="checkbox"
          checked={isViewed}
          disabled={viewedToggleDisabled}
          onChange={(event) => onToggleViewed(event.target.checked)}
        />
        Viewed
      </label>
      <DiffViewer
        filename={filename}
        previousFilename={previousFilename}
        patch={patch ?? ""}
        comments={comments}
        diffOptions={diffOptions}
        userId={userId}
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        headSha={headSha}
        onCommentCreated={onCommentCreated}
      />
    </div>
  )
}
