import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { PlusIcon } from "@primer/octicons-react"
import { PatchDiff } from "@pierre/diffs/react"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"
import { Button } from "@/components/Button"
import styles from "./DiffViewer.module.css"
import type { DiffOptions } from "./DiffOptionsBar"
import { Avatar } from "@/components/Avatar"
import {
  createReviewCommentMutation,
  createSuggestionMutation,
  resolveThreadMutation,
  unresolveThreadMutation,
} from "@/lib/mutations"
import { SuggestionBlock } from "./SuggestionBlock"

type Comment = InstaQLEntity<AppSchema, "prComments">
type AnnotationSide = "additions" | "deletions"
type ReviewSide = "LEFT" | "RIGHT"

type ComposeTarget = {
  line: number
  side: ReviewSide
}
type ComposeMode = "comment" | "suggestion"

interface DiffViewerProps {
  filename: string
  previousFilename: string | null | undefined
  patch: string | null | undefined
  comments?: Comment[]
  diffOptions: DiffOptions
  userId?: string
  owner?: string
  repo?: string
  prNumber?: number
  headSha?: string
  onCommentCreated?: () => void
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

const annotationSideFromReviewSide = (side: ReviewSide): AnnotationSide =>
  side === "LEFT" ? "deletions" : "additions"

const reviewSideFromAnnotationSide = (side: AnnotationSide): ReviewSide =>
  side === "deletions" ? "LEFT" : "RIGHT"

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
const CommentThread = ({
  comments,
  isResolved,
  canToggleResolved,
  isTogglingResolved,
  onToggleResolved,
}: {
  comments: Comment[]
  isResolved: boolean
  canToggleResolved: boolean
  isTogglingResolved: boolean
  onToggleResolved: () => void
}) => {
  return (
    <div className={`${styles.commentThread} ${isResolved ? styles.commentThreadResolved : ""}`}>
      <div className={styles.threadHeader}>
        <span className={`${styles.threadStatus} ${isResolved ? styles.threadStatusResolved : ""}`}>
          {isResolved ? "Resolved" : "Unresolved"}
        </span>
        {canToggleResolved && (
          <Button
            variant="default"
            size="small"
            loading={isTogglingResolved}
            disabled={isTogglingResolved}
            onClick={onToggleResolved}
          >
            {isResolved ? "Unresolve" : "Resolve"}
          </Button>
        )}
      </div>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`${styles.comment} ${isResolved ? styles.commentResolved : ""}`}
        >
          <div className={styles.commentHeader}>
            <Avatar src={comment.authorAvatarUrl} name={comment.authorLogin} size={20} />
            <span className={styles.commentAuthor}>{comment.authorLogin}</span>
            <span className={styles.commentTime}>{formatTimeAgo(comment.githubCreatedAt)}</span>
          </div>
          <div className={styles.commentBody}>
            <SuggestionBlock body={comment.body ?? ""} />
          </div>
        </div>
      ))}
    </div>
  )
}

export const DiffViewer = ({
  filename,
  previousFilename,
  patch,
  comments = [],
  diffOptions,
  userId,
  owner,
  repo,
  prNumber,
  headSha,
  onCommentCreated,
}: DiffViewerProps) => {
  const [composeTarget, setComposeTarget] = useState<ComposeTarget | null>(null)
  const [composeMode, setComposeMode] = useState<ComposeMode>("comment")
  const [composeBody, setComposeBody] = useState("")
  const [suggestionBody, setSuggestionBody] = useState("")
  const [composeError, setComposeError] = useState<string | null>(null)
  const [threadError, setThreadError] = useState<string | null>(null)

  const canCreateInlineComment = Boolean(userId && owner && repo && prNumber && headSha)
  const canToggleThreadResolved = Boolean(userId && owner && repo && prNumber)
  const createReviewComment = useMutation(
    createReviewCommentMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const createSuggestion = useMutation(
    createSuggestionMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const resolveThread = useMutation(
    resolveThreadMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const unresolveThread = useMutation(
    unresolveThreadMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )

  // Only include review comments that have a path matching this file
  const fileComments = useMemo(
    () => comments.filter((c) => c.path === filename),
    [comments, filename],
  )

  const commentsByLine = useMemo(() => groupCommentsByLine(fileComments), [fileComments])

  // Build annotations from comments
  const lineAnnotations = useMemo(() => {
    const annotations: Array<{
      side: AnnotationSide
      lineNumber: number
      metadata: { comments: Comment[]; lineNumber: number; side: ReviewSide }
    }> = []

    for (const [key, cmts] of commentsByLine) {
      const [side, lineStr] = key.split(":")
      const lineNumber = parseInt(lineStr, 10)
      annotations.push({
        side: side as AnnotationSide,
        lineNumber,
        metadata: {
          comments: cmts,
          lineNumber,
          side: reviewSideFromAnnotationSide(side as AnnotationSide),
        },
      })
    }

    if (composeTarget) {
      const key = `${annotationSideFromReviewSide(composeTarget.side)}:${composeTarget.line}`
      const hasExistingAnnotation = commentsByLine.has(key)
      if (!hasExistingAnnotation) {
        annotations.push({
          side: annotationSideFromReviewSide(composeTarget.side),
          lineNumber: composeTarget.line,
          metadata: {
            comments: [],
            lineNumber: composeTarget.line,
            side: composeTarget.side,
          },
        })
      }
    }

    return annotations
  }, [commentsByLine, composeTarget])

  const oldFilename = previousFilename ?? filename
  const formattedPatch = patch
    ? `diff --git a/${oldFilename} b/${filename}
--- a/${oldFilename}
+++ b/${filename}
${patch}`
    : null

  const handleCancelComposer = () => {
    setComposeTarget(null)
    setComposeMode("comment")
    setComposeBody("")
    setSuggestionBody("")
    setComposeError(null)
  }

  const handleSubmitInlineComment = () => {
    if (!composeTarget || !canCreateInlineComment) return
    const body = composeBody.trim()
    if (!body) {
      setComposeError("Comment body is required.")
      return
    }
    if (!headSha) {
      setComposeError("Head SHA is required to create an inline comment.")
      return
    }

    if (composeMode === "suggestion") {
      const suggestion = suggestionBody.trim()
      if (!suggestion) {
        setComposeError("Suggested code is required.")
        return
      }
      createSuggestion.mutate(
        {
          body: body || undefined,
          suggestion,
          path: filename,
          line: composeTarget.line,
          side: composeTarget.side,
          commitId: headSha,
        },
        {
          onSuccess: () => {
            handleCancelComposer()
            onCommentCreated?.()
          },
          onError: (error) => {
            setComposeError(error instanceof Error ? error.message : "Failed to create suggestion")
          },
        },
      )
      return
    }

    createReviewComment.mutate(
      {
        body,
        path: filename,
        line: composeTarget.line,
        side: composeTarget.side,
        commitId: headSha,
      },
      {
        onSuccess: () => {
          handleCancelComposer()
          onCommentCreated?.()
        },
        onError: (error) => {
          setComposeError(error instanceof Error ? error.message : "Failed to create comment")
        },
      },
    )
  }

  return (
    <div className={styles.container}>
      {formattedPatch && (
        <div className={styles.diffContent}>
          <PatchDiff
            patch={formattedPatch}
            options={{
              theme: { dark: "pierre-dark", light: "pierre-light" },
              diffStyle: diffOptions.diffStyle,
              diffIndicators: diffOptions.diffIndicators,
              lineDiffType: diffOptions.lineDiffType,
              disableLineNumbers: diffOptions.disableLineNumbers,
              disableBackground: diffOptions.disableBackground,
              overflow: diffOptions.overflow,
              enableHoverUtility: true,
            }}
            lineAnnotations={lineAnnotations}
            renderAnnotation={(annotation) => {
              const meta = annotation.metadata as {
                comments: Comment[]
                lineNumber: number
                side: ReviewSide
              }
              const threadResolved =
                meta.comments.length > 0 &&
                meta.comments.every((comment) => comment.resolved === true)
              const firstCommentGithubId =
                typeof meta.comments[0]?.githubId === "number" ? meta.comments[0].githubId : null
              const showComposer =
                composeTarget?.line === meta.lineNumber && composeTarget.side === meta.side

              return (
                <div className={styles.annotationContent}>
                  {meta.comments.length > 0 && (
                    <CommentThread
                      comments={meta.comments}
                      isResolved={threadResolved}
                      canToggleResolved={Boolean(canToggleThreadResolved && firstCommentGithubId)}
                      isTogglingResolved={resolveThread.isPending || unresolveThread.isPending}
                      onToggleResolved={() => {
                        if (!firstCommentGithubId) return
                        const mutation = threadResolved ? unresolveThread : resolveThread
                        mutation.mutate(
                          { commentId: firstCommentGithubId },
                          {
                            onSuccess: () => {
                              setThreadError(null)
                              onCommentCreated?.()
                            },
                            onError: (error) => {
                              setThreadError(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to update thread resolution",
                              )
                            },
                          },
                        )
                      }}
                    />
                  )}
                  {threadError && <div className={styles.inlineComposerError}>{threadError}</div>}
                  {showComposer && canCreateInlineComment && (
                    <div className={styles.inlineComposer}>
                      <div className={styles.inlineComposerMeta}>
                        Commenting on line {meta.lineNumber} ({meta.side})
                      </div>
                      <div className={styles.composerModeRow}>
                        <button
                          type="button"
                          className={`${styles.composerModeButton} ${
                            composeMode === "comment" ? styles.composerModeButtonActive : ""
                          }`}
                          onClick={() => setComposeMode("comment")}
                        >
                          Comment
                        </button>
                        <button
                          type="button"
                          className={`${styles.composerModeButton} ${
                            composeMode === "suggestion" ? styles.composerModeButtonActive : ""
                          }`}
                          onClick={() => setComposeMode("suggestion")}
                        >
                          Suggest changes
                        </button>
                      </div>
                      <textarea
                        className={styles.inlineComposerTextarea}
                        rows={3}
                        placeholder={
                          composeMode === "suggestion"
                            ? "Optional context for this suggestion"
                            : "Add an inline review comment"
                        }
                        value={composeBody}
                        onChange={(event) => setComposeBody(event.target.value)}
                      />
                      {composeMode === "suggestion" && (
                        <textarea
                          className={styles.inlineComposerTextarea}
                          rows={4}
                          placeholder="Suggested replacement code"
                          value={suggestionBody}
                          onChange={(event) => setSuggestionBody(event.target.value)}
                        />
                      )}
                      {composeError && (
                        <div className={styles.inlineComposerError}>{composeError}</div>
                      )}
                      <div className={styles.inlineComposerActions}>
                        <Button
                          variant="default"
                          size="small"
                          disabled={createReviewComment.isPending || createSuggestion.isPending}
                          onClick={handleCancelComposer}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="small"
                          loading={createReviewComment.isPending || createSuggestion.isPending}
                          disabled={
                            (composeMode === "comment" && composeBody.trim().length === 0) ||
                            (composeMode === "suggestion" && suggestionBody.trim().length === 0) ||
                            createReviewComment.isPending ||
                            createSuggestion.isPending
                          }
                          onClick={handleSubmitInlineComment}
                        >
                          {composeMode === "suggestion" ? "Add suggestion" : "Add comment"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            }}
            renderHoverUtility={(getHoveredLine) => {
              if (!canCreateInlineComment) return null
              return (
                <Button
                  variant="primary"
                  size="small"
                  type="button"
                  className={styles.addCommentButton}
                  onClick={() => {
                    const result = getHoveredLine()
                    if (!result) return
                    setComposeError(null)
                    setComposeBody("")
                    setSuggestionBody("")
                    setComposeMode("comment")
                    setThreadError(null)
                    setComposeTarget({
                      line: result.lineNumber,
                      side: reviewSideFromAnnotationSide(result.side as AnnotationSide),
                    })
                  }}
                >
                  <PlusIcon size={14} />
                </Button>
              )
            }}
          />
        </div>
      )}
    </div>
  )
}
