import styles from "./CiDot.module.css"

type CiDotVariant = "ready" | "blocked" | "checking"

const variantClassMap: Record<CiDotVariant, string> = {
  ready: styles.ready,
  blocked: styles.blocked,
  checking: styles.checking,
}

export const CiDot = ({ variant, title }: { variant: CiDotVariant; title?: string }) => (
  <span className={`${styles.dot} ${variantClassMap[variant]}`} title={title} aria-hidden />
)
