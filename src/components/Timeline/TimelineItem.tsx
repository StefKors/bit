import type { ReactNode } from "react"
import styles from "./Timeline.module.css"

interface TimelineItemProps {
  children: ReactNode
  className?: string
}

export function TimelineItem({ children, className }: TimelineItemProps) {
  return (
    <li className={className ? `${styles.timelineItem} ${className}` : styles.timelineItem}>
      <div className={styles.lineLeading} aria-hidden>
        <div />
      </div>
      <div className={styles.gapLeading} aria-hidden />
      {children}
      <div className={styles.lineTrailing} aria-hidden>
        <div />
      </div>
      <div className={styles.gapTrailing} aria-hidden />
    </li>
  )
}
