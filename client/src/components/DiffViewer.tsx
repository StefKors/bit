import { useMemo } from "react"
import { PlusIcon } from "@primer/octicons-react"
import { PatchDiff } from "@pierre/diffs/react"
import { Row } from "@rocicorp/zero"
import { Button } from "./Button"
import { Markdown } from "./Markdown"
import styles from "./DiffViewer.module.css"

type Comment = Row["githubPrComment"]

interface DiffViewerProps {
  filename: string
  previousFilename: string | null
  patch: string | null
  additions: number
  deletions: number
  status: string
  comments?: Comment[]
  defaultExpanded?: boolean
}

// Group comments by line and side for annotation rendering
const groupCommentsByLine = (comments: Comment[]) => {
  const map = new Map<string, Comment[]>()
  for (const comment of comments) {
    if (comment.line != null) {
      const side = comment.side === "LEFT" ? "deletions" : "additions"
      const key = `${side}:${comment.line}`
      const existing = map.get(key) || []
      existing.push(comment)
      map.set(key, existing)
    }
  }
  return map
}

// Format time relative to now
const formatTimeAgo = (date: Date | number | null | undefined): string => {
  if (!date) return ""
  const d = typeof date === "number" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

// Comment thread component rendered in annotations
const CommentThread = ({ comments }: { comments: Comment[] }) => {
  return (
    <div className={styles.commentThread}>
      {comments.map((comment) => (
        <div key={comment.id} className={styles.comment}>
          <div className={styles.commentHeader}>
            {comment.authorAvatarUrl && (
              <img
                src={comment.authorAvatarUrl}
                alt={comment.authorLogin ?? ""}
                className={styles.commentAvatar}
              />
            )}
            <span className={styles.commentAuthor}>{comment.authorLogin}</span>
            <span className={styles.commentTime}>
              {formatTimeAgo(comment.githubCreatedAt)}
            </span>
          </div>
          <div className={styles.commentBody}>
            <Markdown content={comment.body ?? ""} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DiffViewer({
  filename,
  previousFilename,
  patch,
  comments = [],
}: DiffViewerProps) {
  // Only include review comments that have a path matching this file
  const fileComments = useMemo(
    () => comments.filter((c) => c.path === filename),
    [comments, filename],
  )

  const commentsByLine = useMemo(
    () => groupCommentsByLine(fileComments),
    [fileComments],
  )

  // Build annotations from comments
  const lineAnnotations = useMemo(() => {
    const annotations: Array<{
      side: "additions" | "deletions"
      lineNumber: number
      metadata: { comments: Comment[] }
    }> = []

    for (const [key, cmts] of commentsByLine) {
      const [side, lineStr] = key.split(":")
      annotations.push({
        side: side as "additions" | "deletions",
        lineNumber: parseInt(lineStr, 10),
        metadata: { comments: cmts },
      })
    }

    return annotations
  }, [commentsByLine])

  const oldFilename = previousFilename ?? filename
  const formattedPatch = patch
    ? `diff --git a/${oldFilename} b/${filename}
--- a/${oldFilename}
+++ b/${filename}
${patch}`
    : null

  return (
    <div className={styles.container}>
      {/* Diff Content */}
      {formattedPatch && (
        <div className={styles.diffContent}>
          <PatchDiff
            patch={formattedPatch}
            options={{
              theme: { dark: "pierre-dark", light: "pierre-light" },
              diffStyle: "split",
              enableHoverUtility: true,
            }}
            lineAnnotations={lineAnnotations}
            // renderHeaderMetadata={() => (
            //   <Button
            //     className={styles.chevron}
            //     onClick={() => setExpanded(!expanded)}
            //     variant="invisible"
            //     size="small"
            //     type="button"
            //   >
            //     {expanded ? (
            //       <ChevronDownIcon size={16} />
            //     ) : (
            //       <ChevronRightIcon size={16} />
            //     )}
            //   </Button>
            // )}
            renderAnnotation={(annotation) => {
              const meta = annotation.metadata as { comments: Comment[] }
              return <CommentThread comments={meta.comments} />
            }}
            renderHoverUtility={(getHoveredLine) => (
              <Button
                variant="primary"
                size="small"
                type="button"
                className={styles.addCommentButton}
                onClick={() => {
                  const result = getHoveredLine()
                  if (!result) return
                  const { lineNumber, side } = result
                  console.log(
                    `Add comment on line ${lineNumber} (${side}) of ${filename}`,
                  )
                  // TODO: Open comment form
                }}
              >
                <PlusIcon size={14} />
              </Button>
            )}
          />
        </div>
      )}
    </div>
  )
}
