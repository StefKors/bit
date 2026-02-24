import { useState } from "react"
import { Button } from "@/components/Button"
import styles from "./ReviewComposer.module.css"

type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

type ReviewComposerProps = {
  onSubmit: (input: { event: ReviewEvent; body: string }) => void
  isSubmitting: boolean
}

export const ReviewComposer = ({ onSubmit, isSubmitting }: ReviewComposerProps) => {
  const [event, setEvent] = useState<ReviewEvent>("COMMENT")
  const [body, setBody] = useState("")

  const canSubmit = body.trim().length > 0 && !isSubmitting

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "APPROVE"}
            onChange={() => setEvent("APPROVE")}
          />
          Approve
        </label>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "REQUEST_CHANGES"}
            onChange={() => setEvent("REQUEST_CHANGES")}
          />
          Request changes
        </label>
        <label className={styles.label}>
          <input
            type="radio"
            name="review-event"
            checked={event === "COMMENT"}
            onChange={() => setEvent("COMMENT")}
          />
          Comment
        </label>
      </div>

      <textarea
        className={styles.textarea}
        placeholder="Write a review comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
      />

      <div className={styles.actions}>
        <Button
          variant="default"
          disabled={!canSubmit}
          loading={isSubmitting}
          onClick={() => onSubmit({ event, body: body.trim() })}
        >
          Submit review
        </Button>
      </div>
    </div>
  )
}
