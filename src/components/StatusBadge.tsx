import styles from "./StatusBadge.module.css"

type StatusBadgeVariant = "open" | "merged" | "closed" | "needsReview" | "draft"

const variantClassMap: Record<StatusBadgeVariant, string> = {
  open: styles.open,
  merged: styles.merged,
  closed: styles.closed,
  needsReview: styles.needsReview,
  draft: styles.draft,
}

export const StatusBadge = ({
  variant,
  icon,
  children,
}: {
  variant: StatusBadgeVariant
  icon?: React.ReactNode
  children: React.ReactNode
}) => (
  <span className={`${styles.badge} ${variantClassMap[variant]}`}>
    {icon}
    {children}
  </span>
)
