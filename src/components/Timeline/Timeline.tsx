import type { ReactNode } from "react"
import styles from "./Timeline.module.css"

interface TimelineProps {
  children: ReactNode
  /** @default "center" */
  align?: "start" | "center"
  className?: string
}

export function Timeline({ children, align = "center", className }: TimelineProps) {
  return (
    <ol
      className={className ? `${styles.timeline} ${className}` : styles.timeline}
      data-align={align}
    >
      {children}
    </ol>
  )
}
