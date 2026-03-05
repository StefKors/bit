import type { ReactNode } from "react"
import styles from "./TimelineItemBase.module.css"

interface TimelineItemBaseProps {
  icon: ReactNode
  header: ReactNode
  children?: ReactNode
  className?: string
  showConnector?: boolean
  bodyWide?: boolean
}

export const TimelineItemBase = ({
  icon,
  header,
  children,
  className,
  showConnector,
  bodyWide,
}: TimelineItemBaseProps) => {
  const hasBody = children != null
  const showLine = hasBody || showConnector

  return (
    <div className={className ? `${styles.timelineItem} ${className}` : styles.timelineItem}>
      <div className={styles.timelineIcon}>{icon}</div>
      <div className={styles.timelineHeader}>{header}</div>
      {showLine && (
        <>
          <div className={styles.timelineLine} aria-hidden />
          {hasBody && (
            <div
              className={
                bodyWide ? `${styles.timelineBody} ${styles.timelineBodyWide}` : styles.timelineBody
              }
            >
              {children}
            </div>
          )}
        </>
      )}
    </div>
  )
}
