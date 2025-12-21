import { Link } from "wouter"
import styles from "./Breadcrumb.module.css"

export interface BreadcrumbItem {
  /** The label to display */
  label: string
  /** Optional href - if provided, renders as a link */
  href?: string
}

interface BreadcrumbProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb}>
      {items.map((item, index) => (
        <span key={index} className={styles.breadcrumbItem}>
          {item.href ? (
            <Link href={item.href} className={styles.breadcrumbLink}>
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 && (
            <span className={styles.breadcrumbSeparator}>/</span>
          )}
        </span>
      ))}
    </nav>
  )
}
