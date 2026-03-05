import { CopyIcon, CheckIcon } from "@primer/octicons-react"
import { useState } from "react"
import styles from "./BranchLabel.module.css"

export const BranchLabel = ({ head, base }: { head: string; base: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void navigator.clipboard.writeText(head)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <span className={styles.branchLabel}>
      <span className={styles.name}>{base}</span>
      <span className={styles.sep}>←</span>
      <span className={styles.name}>{head}</span>
      <button
        type="button"
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label="Copy branch name"
        title="Copy branch name"
      >
        {copied ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
      </button>
    </span>
  )
}
