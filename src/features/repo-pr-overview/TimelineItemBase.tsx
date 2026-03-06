import type { ReactNode } from "react"
import styles from "./TimelineItemBase.module.css"

interface TimelineItemProps {
  className?: string
  children: ReactNode
}

interface TimelineItemBodyProps {
  children: ReactNode
  wide?: boolean
}

interface TimelineItemIconProps {
  children: ReactNode
}

interface TimelineItemHeaderProps {
  children: ReactNode
}

export const TimelineItem = ({ children, className }: TimelineItemProps) => {
  return (
    <div className={className ? `${styles.timelineItem} ${className}` : styles.timelineItem}>
      {children}
    </div>
  )
}

export const TimelineItemIcon = ({ children }: TimelineItemIconProps) => (
  <div className={styles.timelineIcon}>{children}</div>
)

export const TimelineItemHeader = ({ children }: TimelineItemHeaderProps) => (
  <div className={styles.timelineHeader}>{children}</div>
)

export const TimelineItemConnector = () => <div className={styles.timelineLine} aria-hidden />

export const TimelineItemBody = ({ children, wide }: TimelineItemBodyProps) => (
  <div className={wide ? `${styles.timelineBody} ${styles.timelineBodyWide}` : styles.timelineBody}>
    {children}
  </div>
)
