import { motion } from "motion/react"
import styles from "./CiDot.module.css"

type CiDotVariant = "ready" | "blocked" | "checking" | "skipped"

const variantClassMap: Record<CiDotVariant, string> = {
  ready: styles.ready,
  blocked: styles.blocked,
  checking: styles.checking,
  skipped: styles.skipped,
}

export const CiDot = ({ variant, title }: { variant: CiDotVariant; title?: string }) => (
  <motion.span
    className={`${styles.dot} ${variantClassMap[variant]}`}
    title={title}
    aria-hidden
    animate={variant === "checking" ? { opacity: [0.5, 1, 0.5] } : undefined}
    transition={
      variant === "checking" ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined
    }
  />
)
