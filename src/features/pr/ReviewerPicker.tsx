import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/Button"
import { addReviewersMutation, removeReviewersMutation } from "@/lib/mutations"
import styles from "./ReviewerPicker.module.css"

type ReviewerPickerProps = {
  userId?: string
  owner?: string
  repo?: string
  prNumber?: number
  reviewers: string[]
  onUpdated?: () => void
}

const isTeamReviewer = (reviewer: string) => reviewer.startsWith("team:")

const displayReviewer = (reviewer: string) => (isTeamReviewer(reviewer) ? reviewer : `@${reviewer}`)

export const ReviewerPicker = ({
  userId,
  owner,
  repo,
  prNumber,
  reviewers,
  onUpdated,
}: ReviewerPickerProps) => {
  const canManage = Boolean(userId && owner && repo && prNumber)
  const [reviewerInput, setReviewerInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addReviewers = useMutation(
    addReviewersMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const removeReviewers = useMutation(
    removeReviewersMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )

  const addReviewer = () => {
    const value = reviewerInput.trim().replace(/^@/, "")
    if (!value) return
    if (reviewers.includes(value)) {
      setReviewerInput("")
      return
    }

    setError(null)
    addReviewers.mutate(
      { reviewers: [value] },
      {
        onSuccess: () => {
          setReviewerInput("")
          onUpdated?.()
        },
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error ? mutationError.message : "Failed to add reviewer",
          )
        },
      },
    )
  }

  const removeReviewer = (reviewer: string) => {
    setError(null)
    removeReviewers.mutate(
      isTeamReviewer(reviewer)
        ? { reviewers: [], teamReviewers: [reviewer.replace("team:", "")] }
        : { reviewers: [reviewer] },
      {
        onSuccess: () => onUpdated?.(),
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error ? mutationError.message : "Failed to remove reviewer",
          )
        },
      },
    )
  }

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Reviewers</h3>
      </div>
      <div className={styles.chips}>
        {reviewers.length === 0 ? (
          <span className={styles.empty}>No reviewers requested</span>
        ) : (
          reviewers.map((reviewer) => (
            <span key={reviewer} className={styles.chip}>
              {displayReviewer(reviewer)}
              {canManage && (
                <button
                  type="button"
                  className={styles.removeChip}
                  onClick={() => removeReviewer(reviewer)}
                  disabled={removeReviewers.isPending}
                  aria-label={`Remove reviewer ${reviewer}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {canManage && (
        <div className={styles.controls}>
          <input
            value={reviewerInput}
            onChange={(event) => setReviewerInput(event.currentTarget.value)}
            className={styles.input}
            placeholder="Add reviewer by login"
          />
          <Button
            size="small"
            variant="default"
            disabled={addReviewers.isPending || reviewerInput.trim().length === 0}
            loading={addReviewers.isPending}
            onClick={addReviewer}
          >
            Add
          </Button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
