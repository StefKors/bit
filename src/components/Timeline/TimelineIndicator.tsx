import type { ReactNode } from "react"
import styles from "./Timeline.module.css"

interface TimelineIndicatorProps {
  children: ReactNode
  className?: string
}

export function TimelineIndicator({ children, className }: TimelineIndicatorProps) {
  return (
    <div
      className={className ? `${styles.indicator} ${className}` : styles.indicator}
      data-timeline-indicator
    >
      <span className={styles.indicatorBaseline} aria-hidden>
        {"\u200B"}
      </span>
      <div className={styles.indicatorContent}>{children}</div>
    </div>
  )
}
