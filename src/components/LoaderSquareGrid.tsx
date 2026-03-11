import type { CSSProperties } from "react"
import styles from "./LoaderSquareGrid.module.css"

type LoaderSquareGridVariant = "pulse" | "wave" | "orbit"

interface LoaderSquareGridProps {
  size?: number
  variant?: LoaderSquareGridVariant
}

export const LoaderSquareGrid = ({ size = 30, variant = "pulse" }: LoaderSquareGridProps) => {
  return (
    <span
      className={`${styles.root} ${styles[variant]}`}
      style={{ "--loader-square-grid-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
      <span className={styles.cell} />
    </span>
  )
}
