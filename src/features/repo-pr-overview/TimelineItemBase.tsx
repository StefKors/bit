import type { ReactNode } from "react"
import styles from "./TimelineItemBase.module.css"

interface TimelineItemProps {
  className?: string
  children: ReactNode
}

interface TimelineListProps {
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

interface TimelineItemTimeProps {
  children: ReactNode
}

interface TimelineItemContentProps {
  children: ReactNode
  className?: string
}

export const TimelineItem = ({ children, className }: TimelineItemProps) => {
  return (
    <div className={className ? `${styles.timelineItem} ${className}` : styles.timelineItem}>
      {children}
    </div>
  )
}

export const TimelineList = ({ className, children }: TimelineListProps) => (
  <div className={className ? `${styles.timelineList} ${className}` : styles.timelineList}>
    {children}
  </div>
)

export const TimelineItemIcon = ({ children }: TimelineItemIconProps) => (
  <div className={styles.timelineIconWrapper}>
    <div className={styles.timelineIcon}>{children}</div>
  </div>
)

export const TimelineItemHeader = ({ children }: TimelineItemHeaderProps) => (
  <div className={styles.timelineHeader}>{children}</div>
)

export const TimelineItemBody = ({ children, wide }: TimelineItemBodyProps) => (
  <div className={wide ? `${styles.timelineBody} ${styles.timelineBodyWide}` : styles.timelineBody}>
    {children}
  </div>
)

export const TimelineItemTime = ({ children }: TimelineItemTimeProps) => (
  <time className={styles.timelineTime}>{children}</time>
)

export const TimelineItemContent = ({ children, className }: TimelineItemContentProps) => (
  <div className={className ? `${styles.timelineContent} ${className}` : styles.timelineContent}>
    {children}
  </div>
)
