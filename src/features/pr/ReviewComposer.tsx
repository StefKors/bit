import { useState } from "react"
import { Button } from "@/components/Button"
import styles from "./ReviewComposer.module.css"

type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

type ReviewComposerProps = {
  reviewId: number | null
  onSubmit: (input: { event: ReviewEvent; body: string }) => void
  onStartDraft: (body: string) => void
  onSubmitDraft: (input: { reviewId: number; event: ReviewEvent; body: string }) => void
  onDiscardDraft: (reviewId: number) => void
  isSubmitting: boolean
}

export const ReviewComposer = ({
  reviewId,
  onSubmit,
  onStartDraft,
  onSubmitDraft,
  onDiscardDraft,
  isSubmitting,
}: ReviewComposerProps) => {
  const [event, setEvent] = useState<ReviewEvent>("COMMENT")
  const [body, setBody] = useState("")

  const trimmedBody = body.trim()
  const canSubmit = trimmedBody.length > 0 && !isSubmitting

  return (
    <div className={styles.container}>
      {reviewId && (
        <div className={styles.pendingReviewBanner}>Pending draft review #{reviewId}</div>
      )}

      <div className={styles.controls}>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "APPROVE"}
            onChange={() => {
              setEvent("APPROVE")
            }}
          />
          Approve
        </label>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "REQUEST_CHANGES"}
            onChange={() => {
              setEvent("REQUEST_CHANGES")
            }}
          />
          Request changes
        </label>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "COMMENT"}
            onChange={() => {
              setEvent("COMMENT")
            }}
          />
          Comment
        </label>
      </div>

      <textarea
        className={styles.textarea}
        placeholder="Write a review comment"
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
        }}
        rows={4}
      />

      <div className={styles.actions}>
        {reviewId ? (
          <>
            <Button
              variant="danger"
              disabled={isSubmitting}
              loading={isSubmitting}
              onClick={() => {
                onDiscardDraft(reviewId)
              }}
            >
              Discard review
            </Button>
            <Button
              variant="default"
              disabled={!canSubmit}
              loading={isSubmitting}
              onClick={() => {
                onSubmitDraft({ reviewId, event, body: trimmedBody })
              }}
            >
              Finish your review
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              disabled={isSubmitting}
              loading={isSubmitting}
              onClick={() => {
                onStartDraft(trimmedBody)
              }}
            >
              Start review
            </Button>
            <Button
              variant="default"
              disabled={!canSubmit}
              loading={isSubmitting}
              onClick={() => {
                onSubmit({ event, body: trimmedBody })
              }}
            >
              Submit review
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
