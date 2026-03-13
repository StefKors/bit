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
    <div className={styles.branchLabel}>
      <span className={`${styles.name} ${styles.base}`}>{base}</span>
      <span className={styles.sep}>←</span>
      <div className={styles.group}>
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label="Copy branch name"
          title="Copy branch name"
        >
          <span className={`${styles.head}`}>{head}</span>
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
        </button>
      </div>
    </div>
  )
}
