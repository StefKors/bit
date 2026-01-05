import { useState, useRef } from "react"
import { GitCommitIcon, XIcon } from "@primer/octicons-react"
import styles from "./CommitInfo.module.css"

const commitInfo = __COMMIT_INFO__

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const CommitInfo = () => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePillClick = () => {
    setIsOpen((prev) => !prev)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
          }}
          onClick={handleBackdropClick}
        />
      )}
      <div className={styles.container} ref={containerRef}>
        {isOpen && (
          <div className={styles.popover}>
            <div className={styles.popoverHeader}>
              <GitCommitIcon size={16} className={styles.popoverIcon} />
              <h3 className={styles.popoverTitle}>Build Commit</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  color: "rgba(var(--bit-rgb-fg), 0.5)",
                }}
              >
                <XIcon size={14} />
              </button>
            </div>
            <p className={styles.commitTitle}>{commitInfo.title}</p>
            <div className={styles.detailsGrid}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>SHA</span>
                <span className={styles.shaBadge}>{commitInfo.shortSha}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Author</span>
                <span className={styles.detailValueText}>{commitInfo.author}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Date</span>
                <span className={styles.detailValue}>{formatDate(commitInfo.date)}</span>
              </div>
            </div>
          </div>
        )}
        <button className={styles.pill} onClick={handlePillClick}>
          <GitCommitIcon size={14} className={styles.icon} />
          <span className={styles.sha}>{commitInfo.shortSha}</span>
        </button>
      </div>
    </>
  )
}
