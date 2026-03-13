import styles from "./StatusIcon.module.css"

type StatusIconVariant = "open" | "merged" | "closed" | "needsReview" | "draft" | "approved"

const variantClassMap: Record<StatusIconVariant, string> = {
  open: styles.open,
  merged: styles.merged,
  closed: styles.closed,
  needsReview: styles.needsReview,
  draft: styles.draft,
  approved: styles.approved,
}

export const StatusIcon = ({
  variant,
  icon,
}: {
  variant: StatusIconVariant
  icon?: React.ReactNode
  label?: string
}) => {
  if (icon == null) {
    return null
  }

  return (
    <span className={`${styles.badge} ${variantClassMap[variant]}`}>
      <span className={styles.icon}>{icon}</span>
    </span>
  )
}
