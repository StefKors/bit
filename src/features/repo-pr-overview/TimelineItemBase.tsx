import type { ReactNode } from "react"
import styles from "./timeline-item-base.module.css"

interface TimelineItemBaseProps {
  icon: ReactNode
  header: ReactNode
  children: ReactNode
  className?: string
}

export const TimelineItemBase = ({ icon, header, children, className }: TimelineItemBaseProps) => (
  <div className={className ? `${styles.timelineItem} ${className}` : styles.timelineItem}>
    <div className={styles.timelineIcon}>{icon}</div>
    <div className={styles.timelineHeader}>{header}</div>
    <div className={styles.timelineLine} aria-hidden />
    <div className={styles.timelineBody}>{children}</div>
  </div>
)
