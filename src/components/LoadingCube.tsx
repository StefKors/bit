import styles from "./LoadingCube.module.css"

interface LoadingCubeProps {
  size?: number
}

export const LoadingCube = ({ size = 48 }: LoadingCubeProps) => {
  // Isometric cube paths - matching the bit-cube shape
  // Top face, left face, right face outlines
  const topFace = "M24 4 L44 16 L24 28 L4 16 Z"
  const leftFace = "M4 16 L24 28 L24 48 L4 36 Z"
  const rightFace = "M24 28 L44 16 L44 36 L24 48 Z"

  return (
    <div className={styles.container}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 52"
        fill="none"
        className={styles.cube}
      >
        <path d={topFace} className={styles.line} />
        <path d={leftFace} className={styles.line} />
        <path d={rightFace} className={styles.line} />
      </svg>
    </div>
  )
}
