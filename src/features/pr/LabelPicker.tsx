import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/Button"
import { addLabelsMutation, removeLabelMutation, setLabelsMutation } from "@/lib/mutations"
import styles from "./LabelPicker.module.css"

interface Label {
  name: string
  color: string | null
}

interface LabelPickerProps {
  userId?: string
  owner?: string
  repo?: string
  prNumber?: number
  labels: Label[]
  onUpdated?: () => void
}

const getContrastColor = (hexColor: string): string => {
  const r = parseInt(hexColor.substring(0, 2), 16)
  const g = parseInt(hexColor.substring(2, 4), 16)
  const b = parseInt(hexColor.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export const LabelPicker = ({
  userId,
  owner,
  repo,
  prNumber,
  labels,
  onUpdated,
}: LabelPickerProps) => {
  const canManage = Boolean(userId && owner && repo && prNumber)
  const [labelInput, setLabelInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addLabels = useMutation(
    addLabelsMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const removeLabel = useMutation(
    removeLabelMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )
  const setLabels = useMutation(
    setLabelsMutation(userId ?? "", owner ?? "", repo ?? "", prNumber ?? 0),
  )

  const addLabel = () => {
    const nextLabel = labelInput.trim()
    if (nextLabel.length === 0) return
    if (labels.some((label) => label.name === nextLabel)) {
      setLabelInput("")
      return
    }

    setError(null)
    addLabels.mutate(
      { labels: [nextLabel] },
      {
        onSuccess: () => {
          setLabelInput("")
          onUpdated?.()
        },
        onError: (mutationError) => {
          setError(mutationError instanceof Error ? mutationError.message : "Failed to add label")
        },
      },
    )
  }

  const clearAllLabels = () => {
    setError(null)
    setLabels.mutate(
      { labels: [] },
      {
        onSuccess: () => onUpdated?.(),
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error ? mutationError.message : "Failed to clear labels",
          )
        },
      },
    )
  }

  const removeOneLabel = (labelName: string) => {
    setError(null)
    removeLabel.mutate(
      { label: labelName },
      {
        onSuccess: () => onUpdated?.(),
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error ? mutationError.message : "Failed to remove label",
          )
        },
      },
    )
  }

  const isBusy = addLabels.isPending || removeLabel.isPending || setLabels.isPending

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Labels</h3>
        {canManage && labels.length > 0 && (
          <Button size="small" variant="invisible" disabled={isBusy} onClick={clearAllLabels}>
            Clear all
          </Button>
        )}
      </div>
      <div className={styles.labels}>
        {labels.length === 0 ? (
          <span className={styles.empty}>No labels applied</span>
        ) : (
          labels.map((label) => (
            <span
              key={label.name}
              className={styles.labelChip}
              style={{
                backgroundColor: label.color ? `#${label.color}` : undefined,
                color: label.color ? getContrastColor(label.color) : undefined,
              }}
            >
              {label.name}
              {canManage && (
                <button
                  type="button"
                  className={styles.removeChip}
                  onClick={() => {
                    removeOneLabel(label.name)
                  }}
                  disabled={isBusy}
                  aria-label={`Remove label ${label.name}`}
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
            value={labelInput}
            onChange={(event) => {
              setLabelInput(event.currentTarget.value)
            }}
            className={styles.input}
            placeholder="Add label name"
          />
          <Button
            size="small"
            variant="default"
            disabled={isBusy || labelInput.trim().length === 0}
            loading={addLabels.isPending}
            onClick={addLabel}
          >
            Add
          </Button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
