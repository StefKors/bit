import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { GitMergeIcon, AlertIcon, ChevronDownIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import { mergePRMutation, updatePRStateMutation } from "@/lib/mutations"
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
  mergeable?: boolean | null
  mergeableState?: string | null
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
  mergeable,
  mergeableState,
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

  if (isMerged) {
    return null
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
          <Button
            variant="default"
            loading={isUpdatingState}
            disabled={isUpdatingState}
            onClick={handleStateToggle}
          >
            {isUpdatingState ? "Reopening..." : "Reopen pull request"}
          </Button>
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
                onClick={() => setShowMethodDropdown(!showMethodDropdown)}
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
              disabled={isMerging || isUpdatingState}
              onClick={handleMerge}
              className={styles.confirmButton}
            >
              {isMerging ? "Merging..." : "Merge pull request"}
            </Button>
            <Button
              variant="danger"
              loading={isUpdatingState}
              disabled={isMerging || isUpdatingState}
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
          onClick={() => setShowMethodDropdown(false)}
          role="presentation"
        />
      )}
    </div>
  )
}
