import { useState } from "react"
import { Button } from "@/components/Button"
import { Markdown } from "@/components/Markdown"
import styles from "./CommentComposer.module.css"

type CommentComposerProps = {
  onSubmit: (body: string) => void
  isSubmitting: boolean
}

export const CommentComposer = ({ onSubmit, isSubmitting }: CommentComposerProps) => {
  const [body, setBody] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const canSubmit = body.trim().length > 0 && !isSubmitting

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${!showPreview ? styles.tabActive : ""}`}
            onClick={() => setShowPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={`${styles.tab} ${showPreview ? styles.tabActive : ""}`}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {!showPreview ? (
        <textarea
          className={styles.textarea}
          placeholder="Leave a comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
        />
      ) : (
        <div className={styles.preview}>
          {body.trim().length > 0 ? (
            <Markdown content={body} />
          ) : (
            <p className={styles.previewPlaceholder}>Nothing to preview.</p>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={isSubmitting}
          onClick={() => onSubmit(body.trim())}
        >
          Comment
        </Button>
      </div>
    </div>
  )
}
