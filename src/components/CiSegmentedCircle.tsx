import styles from "./CiSegmentedCircle.module.css"

interface CiSegmentedCircleProps {
  pendingCount: number
  inProgressCount: number
  failedCount: number
  skippedCount: number
  successfulCount: number
  size?: number
  strokeWidth?: number
}

interface Segment {
  key: string
  count: number
  className: string
}

export const CiSegmentedCircle = ({
  pendingCount,
  inProgressCount,
  failedCount,
  skippedCount,
  successfulCount,
  size = 16,
  strokeWidth = 3,
}: CiSegmentedCircleProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = pendingCount + inProgressCount + failedCount + skippedCount + successfulCount
  const segments: Segment[] = [
    { key: "pending", count: pendingCount, className: styles.pending },
    { key: "inProgress", count: inProgressCount, className: styles.inProgress },
    { key: "failed", count: failedCount, className: styles.failed },
    { key: "skipped", count: skippedCount, className: styles.skipped },
    { key: "successful", count: successfulCount, className: styles.successful },
  ]

  let offset = 0
  const title = `CI jobs: ${pendingCount} pending, ${inProgressCount} in progress, ${failedCount} failed, ${skippedCount} skipped, ${successfulCount} successful`

  return (
    <span className={styles.root} title={title} aria-label={title} role="img">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={styles.track}
          strokeWidth={strokeWidth}
        />
        {total > 0
          ? segments.map((segment) => {
              if (segment.count <= 0) return null
              const segmentLength = (segment.count / total) * circumference
              const circle = (
                <circle
                  key={segment.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  className={`${styles.segment} ${segment.className}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += segmentLength
              return circle
            })
          : null}
      </svg>
    </span>
  )
}
