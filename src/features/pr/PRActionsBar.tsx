import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { GitMergeIcon, AlertIcon, ChevronDownIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import {
  convertToDraftMutation,
  deleteBranchMutation,
  lockPRMutation,
  markReadyForReviewMutation,
  mergePRMutation,
  restoreBranchMutation,
  unlockPRMutation,
  updatePRStateMutation,
} from "@/lib/mutations"
import styles from "./PRActionsBar.module.css"

type MergeMethod = "merge" | "squash" | "rebase"

interface PRActionsBarProps {
  userId: string
  owner: string
  repo: string
  prNumber: number
  isOpen: boolean
  isDraft: boolean
  isMerged: boolean
  isLocked?: boolean
  lockReason?: string | null
  mergeable?: boolean | null
  mergeableState?: string | null
  headRef: string
  headSha: string
  onMergeSuccess?: () => void
  onStateChange?: (nextState: "open" | "closed") => void
}

export function PRActionsBar({
  userId,
  owner,
  repo,
  prNumber,
  isOpen,
  isDraft,
  isMerged,
  isLocked = false,
  lockReason = null,
  mergeable,
  mergeableState,
  headRef,
  headSha,
  onMergeSuccess,
  onStateChange,
}: PRActionsBarProps) {
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod>("merge")
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const merge = useMutation({
    ...mergePRMutation(userId, owner, repo, prNumber),
    onSuccess: () => {
      setError(null)
      onMergeSuccess?.()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to merge")
    },
  })

  const updateState = useMutation({
    ...updatePRStateMutation(userId, owner, repo, prNumber),
    onSuccess: (result) => {
      setError(null)
      onStateChange?.(result.state)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update pull request state")
    },
  })

  const isMerging = merge.isPending
  const isUpdatingState = updateState.isPending

  const convertToDraft = useMutation({
    ...convertToDraftMutation(userId, owner, repo, prNumber),
    onSuccess: (result) => {
      setError(null)
      onStateChange?.(result.state)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to convert pull request to draft")
    },
  })

  const markReadyForReview = useMutation({
    ...markReadyForReviewMutation(userId, owner, repo, prNumber),
    onSuccess: (result) => {
      setError(null)
      onStateChange?.(result.state)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to mark pull request as ready")
    },
  })

  const deleteBranch = useMutation({
    ...deleteBranchMutation(userId, owner, repo),
    onSuccess: () => {
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete branch")
    },
  })

  const restoreBranch = useMutation({
    ...restoreBranchMutation(userId, owner, repo),
    onSuccess: () => {
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to restore branch")
    },
  })

  const lockConversation = useMutation({
    ...lockPRMutation(userId, owner, repo, prNumber),
    onSuccess: () => {
      setError(null)
      onStateChange?.(isOpen ? "open" : "closed")
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to lock conversation")
    },
  })

  const unlockConversation = useMutation({
    ...unlockPRMutation(userId, owner, repo, prNumber),
    onSuccess: () => {
      setError(null)
      onStateChange?.(isOpen ? "open" : "closed")
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to unlock conversation")
    },
  })

  if (isMerged) {
    const isBranchActionPending =
      deleteBranch.isPending ||
      restoreBranch.isPending ||
      lockConversation.isPending ||
      unlockConversation.isPending
    const canRestore = deleteBranch.isSuccess
    const canDelete = headRef.length > 0
    const canRestoreBranch = canRestore && headSha.length > 0

    return (
      <div className={styles.container}>
        {error && (
          <div className={styles.errorBanner}>
            <AlertIcon size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className={styles.mergeBar}>
          <div className={styles.mergeActions}>
            <Button
              variant="danger"
              loading={deleteBranch.isPending}
              disabled={isBranchActionPending || !canDelete}
              onClick={() => {
                setError(null)
                deleteBranch.mutate({ branch: headRef })
              }}
            >
              {deleteBranch.isPending ? "Deleting..." : "Delete source branch"}
            </Button>

            {canRestore && (
              <Button
                variant="default"
                loading={restoreBranch.isPending}
                disabled={isBranchActionPending || !canRestoreBranch}
                onClick={() => {
                  setError(null)
                  restoreBranch.mutate({ branch: headRef, sha: headSha })
                }}
              >
                {restoreBranch.isPending ? "Restoring..." : "Restore branch"}
              </Button>
            )}
            <Button
              variant="default"
              loading={lockConversation.isPending || unlockConversation.isPending}
              disabled={isBranchActionPending}
              onClick={() => {
                setError(null)
                if (isLocked) {
                  unlockConversation.mutate()
                } else {
                  lockConversation.mutate({ lockReason: "resolved" })
                }
              }}
            >
              {isLocked ? "Unlock conversation" : "Lock conversation"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const handleStateToggle = () => {
    setError(null)
    updateState.mutate(isOpen ? "closed" : "open")
  }

  if (!isOpen) {
    return (
      <div className={styles.container}>
        {error && (
          <div className={styles.errorBanner}>
            <AlertIcon size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className={styles.mergeBar}>
          <div className={styles.mergeActions}>
            <Button
              variant="default"
              loading={isUpdatingState}
              disabled={
                isUpdatingState || lockConversation.isPending || unlockConversation.isPending
              }
              onClick={handleStateToggle}
            >
              {isUpdatingState ? "Reopening..." : "Reopen pull request"}
            </Button>
            <Button
              variant="default"
              loading={lockConversation.isPending || unlockConversation.isPending}
              disabled={
                isUpdatingState || lockConversation.isPending || unlockConversation.isPending
              }
              onClick={() => {
                setError(null)
                if (isLocked) {
                  unlockConversation.mutate()
                } else {
                  lockConversation.mutate({ lockReason: "resolved" })
                }
              }}
              title={lockReason ? `Lock reason: ${lockReason}` : undefined}
            >
              {isLocked ? "Unlock conversation" : "Lock conversation"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isDraft) {
    return (
      <div className={styles.container}>
        <div className={styles.draftBanner}>
          <AlertIcon size={16} className={styles.draftIcon} />
          <span>This pull request is still a draft</span>
          <Button
            variant="primary"
            size="small"
            loading={markReadyForReview.isPending}
            disabled={
              markReadyForReview.isPending ||
              isUpdatingState ||
              lockConversation.isPending ||
              unlockConversation.isPending
            }
            onClick={() => {
              setError(null)
              markReadyForReview.mutate()
            }}
          >
            Ready for review
          </Button>
          <Button
            variant="default"
            size="small"
            loading={lockConversation.isPending || unlockConversation.isPending}
            disabled={
              markReadyForReview.isPending ||
              lockConversation.isPending ||
              unlockConversation.isPending
            }
            onClick={() => {
              setError(null)
              if (isLocked) {
                unlockConversation.mutate()
              } else {
                lockConversation.mutate({ lockReason: "resolved" })
              }
            }}
            title={lockReason ? `Lock reason: ${lockReason}` : undefined}
          >
            {isLocked ? "Unlock conversation" : "Lock conversation"}
          </Button>
        </div>
      </div>
    )
  }

  // Check mergeability
  const hasConflicts = mergeable === false
  const isChecking = mergeable === null || mergeableState === "unknown"

  const methodLabels: Record<MergeMethod, string> = {
    merge: "Create a merge commit",
    squash: "Squash and merge",
    rebase: "Rebase and merge",
  }

  const handleMerge = () => {
    setError(null)
    merge.mutate({
      mergeMethod: selectedMethod,
      sha: headSha,
    })
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner}>
          <AlertIcon size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.mergeBar}>
        {hasConflicts ? (
          <div className={styles.conflictWarning}>
            <AlertIcon size={16} className={styles.conflictIcon} />
            <span>This branch has conflicts that must be resolved</span>
          </div>
        ) : isChecking ? (
          <div className={styles.checkingText}>Checking mergeability...</div>
        ) : (
          <div className={styles.mergeActions}>
            <div className={styles.methodSelector}>
              <Button
                variant="success"
                leadingIcon={<GitMergeIcon size={16} />}
                trailingIcon={<ChevronDownIcon size={16} />}
                onClick={() => {
                  setShowMethodDropdown(!showMethodDropdown)
                }}
                disabled={isMerging}
                className={styles.mergeButton}
              >
                {methodLabels[selectedMethod]}
              </Button>

              {showMethodDropdown && (
                <div className={styles.dropdown}>
                  {(Object.keys(methodLabels) as MergeMethod[]).map((method) => (
                    <button
                      key={method}
                      className={`${styles.dropdownItem} ${
                        selectedMethod === method ? styles.dropdownItemSelected : ""
                      }`}
                      onClick={() => {
                        setSelectedMethod(method)
                        setShowMethodDropdown(false)
                      }}
                    >
                      <div className={styles.dropdownItemTitle}>{methodLabels[method]}</div>
                      <div className={styles.dropdownItemDescription}>
                        {method === "merge" &&
                          "All commits from this branch will be added to the base branch."}
                        {method === "squash" &&
                          "The 1 commit from this branch will be squashed into a single commit."}
                        {method === "rebase" &&
                          "The 1 commit from this branch will be rebased and added to the base branch."}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="success"
              loading={isMerging}
              disabled={
                isMerging ||
                isUpdatingState ||
                convertToDraft.isPending ||
                lockConversation.isPending ||
                unlockConversation.isPending
              }
              onClick={handleMerge}
              className={styles.confirmButton}
            >
              {isMerging ? "Merging..." : "Merge pull request"}
            </Button>
            <Button
              variant="default"
              loading={convertToDraft.isPending}
              disabled={
                isMerging ||
                isUpdatingState ||
                convertToDraft.isPending ||
                lockConversation.isPending ||
                unlockConversation.isPending
              }
              onClick={() => {
                setError(null)
                convertToDraft.mutate()
              }}
              className={styles.closeButton}
            >
              {convertToDraft.isPending ? "Converting..." : "Convert to draft"}
            </Button>
            <Button
              variant="default"
              loading={lockConversation.isPending || unlockConversation.isPending}
              disabled={
                isMerging ||
                isUpdatingState ||
                convertToDraft.isPending ||
                lockConversation.isPending ||
                unlockConversation.isPending
              }
              onClick={() => {
                setError(null)
                if (isLocked) {
                  unlockConversation.mutate()
                } else {
                  lockConversation.mutate({ lockReason: "resolved" })
                }
              }}
              title={lockReason ? `Lock reason: ${lockReason}` : undefined}
              className={styles.closeButton}
            >
              {isLocked ? "Unlock conversation" : "Lock conversation"}
            </Button>
            <Button
              variant="danger"
              loading={isUpdatingState}
              disabled={
                isMerging ||
                isUpdatingState ||
                convertToDraft.isPending ||
                lockConversation.isPending ||
                unlockConversation.isPending
              }
              onClick={handleStateToggle}
              className={styles.closeButton}
            >
              {isUpdatingState ? "Closing..." : "Close pull request"}
            </Button>
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showMethodDropdown && (
        <div
          className={styles.dropdownOverlay}
          onClick={() => {
            setShowMethodDropdown(false)
          }}
          role="presentation"
        />
      )}
    </div>
  )
}
