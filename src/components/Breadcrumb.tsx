import { Link } from "@tanstack/react-router"
import styles from "./Breadcrumb.module.css"

export interface BreadcrumbItem {
  /** The label to display */
  label: string
  /** Route path - if provided, renders as a link */
  to?: string
  /** Route params for dynamic segments */
  params?: Record<string, string>
}

interface BreadcrumbProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[]
  /** Additional class name for custom styling */
  className?: string
  /** Compact variant for use in headers */
  variant?: "default" | "compact"
}

export const Breadcrumb = ({ items, className, variant = "default" }: BreadcrumbProps) => {
  const isCompact = variant === "compact"

  return (
    <nav className={`${styles.breadcrumb} ${isCompact ? styles.compact : ""} ${className ?? ""}`}>
      {items.map((item, index) => (
        <span key={index} className={styles.breadcrumbItem}>
          {item.to ? (
            <Link to={item.to} params={item.params} className={styles.breadcrumbLink}>
              {item.label}
            </Link>
          ) : (
            <span className={styles.breadcrumbCurrent}>{item.label}</span>
          )}
          {index < items.length - 1 && <span className={styles.breadcrumbSeparator}>/</span>}
        </span>
      ))}
    </nav>
  )
}
