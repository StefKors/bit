import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  AlertIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  PencilIcon,
} from "@primer/octicons-react"
import { Button } from "@/components/Button"
import { Markdown } from "@/components/Markdown"
import { updatePRMutation } from "@/lib/mutations"
import { ChecksList, type PullRequestCheck } from "./ChecksList"
import styles from "./PRHeader.module.css"

type PullRequestState = "open" | "closed"

type PRHeaderProps = {
  userId?: string
  owner?: string
  repo?: string
  prNumber: number
  title: string
  body?: string | null
  state: PullRequestState
  draft: boolean
  merged: boolean
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  baseRef?: string | null
  headRef?: string | null
  githubCreatedAt?: Date | number | null
  mergedAt?: Date | number | null
  closedAt?: Date | number | null
  mergeable?: boolean | null
  mergeableState?: string | null
  checks?: readonly PullRequestCheck[]
  onUpdated?: () => void
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

const getStatusLabel = (params: { draft: boolean; merged: boolean; state: PullRequestState }) => {
  if (params.draft) return "Draft"
  if (params.merged) return "Merged"
  if (params.state === "closed") return "Closed"
  return "Open"
}

const getStatusClassName = (params: {
  draft: boolean
  merged: boolean
  state: PullRequestState
}) => {
  if (params.draft) return styles.statusDraft
  if (params.merged) return styles.statusMerged
  if (params.state === "closed") return styles.statusClosed
  return styles.statusOpen
}

const HeaderStateIcon = ({
  draft,
  merged,
  state,
}: {
  draft: boolean
  merged: boolean
  state: PullRequestState
}) => {
  if (merged) {
    return <GitMergeIcon className={`${styles.prIcon} ${styles.prIconMerged}`} size={24} />
  }
  if (draft) {
    return (
      <GitPullRequestDraftIcon className={`${styles.prIcon} ${styles.prIconDraft}`} size={24} />
    )
  }
  if (state === "closed") {
    return (
      <GitPullRequestClosedIcon className={`${styles.prIcon} ${styles.prIconClosed}`} size={24} />
    )
  }
  return <GitPullRequestIcon className={`${styles.prIcon} ${styles.prIconOpen}`} size={24} />
}

export const PRHeader = ({
  userId,
  owner,
  repo,
  prNumber,
  title,
  body,
  state,
  draft,
  merged,
  authorLogin,
  authorAvatarUrl,
  baseRef,
  headRef,
  githubCreatedAt,
  mergedAt,
  closedAt,
  mergeable = null,
  mergeableState = null,
  checks = [],
  onUpdated,
  formatTimeAgo,
}: PRHeaderProps) => {
  const canEdit = Boolean(userId && owner && repo && prNumber > 0)
  const isOpen = state === "open"
  const hasMergeConflicts = mergeable === false
  const isMergeabilityChecking = mergeable === null || mergeableState === "unknown"

  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftBody, setDraftBody] = useState(body ?? "")
  const [error, setError] = useState<string | null>(null)

  const updatePR = useMutation(updatePRMutation(userId ?? "", owner ?? "", repo ?? "", prNumber))

  const openEditMode = () => {
    setError(null)
    setDraftTitle(title)
    setDraftBody(body ?? "")
    setIsEditing(true)
  }

  const closeEditMode = () => {
    setError(null)
    setIsEditing(false)
  }

  const saveChanges = () => {
    const normalizedTitle = draftTitle.trim()
    const currentBody = body ?? ""
    const nextBody = draftBody

    if (normalizedTitle.length === 0) {
      setError("Title cannot be empty")
      return
    }

    const payload: { title?: string; body?: string } = {}
    if (normalizedTitle !== title) payload.title = normalizedTitle
    if (nextBody !== currentBody) payload.body = nextBody

    if (Object.keys(payload).length === 0) {
      closeEditMode()
      return
    }

    updatePR.mutate(payload, {
      onSuccess: () => {
        setError(null)
        setIsEditing(false)
        onUpdated?.()
      },
      onError: (mutationError) => {
        setError(
          mutationError instanceof Error ? mutationError.message : "Failed to update pull request",
        )
      },
    })
  }

  return (
    <header className={styles.header}>
      {error && (
        <div className={styles.errorBanner}>
          <AlertIcon size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className={styles.titleRow}>
        <HeaderStateIcon draft={draft} merged={merged} state={state} />
        <div className={styles.titleSection}>
          {!isEditing ? (
            <div className={styles.titleLine}>
              <h1 className={styles.title}>
                {title}
                <span className={styles.prNumber}> #{prNumber}</span>
                <span
                  className={`${styles.statusBadge} ${getStatusClassName({ draft, merged, state })}`}
                >
                  {getStatusLabel({ draft, merged, state })}
                </span>
              </h1>
              {canEdit && (
                <Button
                  size="small"
                  variant="default"
                  leadingIcon={<PencilIcon size={14} />}
                  onClick={openEditMode}
                >
                  Edit
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.editForm}>
              <input
                className={styles.titleInput}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.currentTarget.value)}
                placeholder="Pull request title"
              />
              <textarea
                className={styles.bodyInput}
                value={draftBody}
                onChange={(event) => setDraftBody(event.currentTarget.value)}
                placeholder="Describe your pull request"
                rows={8}
              />
              <div className={styles.editActions}>
                <Button
                  variant="primary"
                  loading={updatePR.isPending}
                  disabled={updatePR.isPending}
                  onClick={saveChanges}
                >
                  Save changes
                </Button>
                <Button variant="default" disabled={updatePR.isPending} onClick={closeEditMode}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className={styles.meta}>
            {authorLogin && (
              <span className={styles.metaItem}>
                {authorAvatarUrl && (
                  <img src={authorAvatarUrl} alt={authorLogin} className={styles.authorAvatar} />
                )}
                <strong>{authorLogin}</strong>
              </span>
            )}
            <span className={styles.metaItem}>
              wants to merge into
              <span className={styles.branchInfo}>{baseRef ?? "unknown"}</span>
              from
              <span className={styles.branchInfo}>{headRef ?? "unknown"}</span>
            </span>
            <span className={styles.metaItem}>
              {isOpen
                ? `opened ${formatTimeAgo(githubCreatedAt)}`
                : merged
                  ? `merged ${formatTimeAgo(mergedAt)}`
                  : `closed ${formatTimeAgo(closedAt)}`}
            </span>
          </div>

          {hasMergeConflicts ? (
            <div className={styles.mergeConflictWarning}>
              <AlertIcon size={16} />
              <span>This branch has merge conflicts that must be resolved</span>
            </div>
          ) : (
            isMergeabilityChecking && (
              <div className={styles.mergeabilityChecking}>Checking mergeability...</div>
            )
          )}
        </div>
      </div>

      {!isEditing && body && (
        <div className={styles.description}>
          <Markdown content={body} />
        </div>
      )}

      <div className={styles.checks}>
        <ChecksList checks={checks} />
      </div>
    </header>
  )
}
