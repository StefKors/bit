import styles from "./CiSegmentedCircle.module.css"
import { buildSegmentGeometry } from "./CiSegmentedCircleMath"

interface CiSegmentedCircleProps {
  pendingCount: number
  inProgressCount: number
  failedCount: number
  skippedCount: number
  successfulCount: number
  size?: number
  strokeWidth?: number
  segmentGap?: number
  minSegmentWidth?: number
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
  size = 14,
  strokeWidth = 2,
  segmentGap = 2.0,
  minSegmentWidth = 2,
}: CiSegmentedCircleProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const segments: Segment[] = [
    { key: "pending", count: pendingCount, className: styles.pending },
    { key: "inProgress", count: inProgressCount, className: styles.inProgress },
    { key: "failed", count: failedCount, className: styles.failed },
    { key: "skipped", count: skippedCount, className: styles.skipped },
    { key: "successful", count: successfulCount, className: styles.successful },
  ]
  const segmentGeometry = buildSegmentGeometry({
    segments,
    circumference,
    segmentGap,
    strokeWidth,
    minSegmentWidth,
  })
  const title = `CI jobs: ${pendingCount} pending, ${inProgressCount} in progress, ${failedCount} failed, ${skippedCount} skipped, ${successfulCount} successful`

  return (
    <span className={styles.root} title={title} aria-label={title} role="img">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size + strokeWidth} ${size + strokeWidth}`}
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
        {segmentGeometry.length > 0
          ? segmentGeometry.map((geometry) => {
              const segment = segments.find((entry) => entry.key === geometry.key)
              if (!segment) return null
              const circle = (
                <circle
                  key={geometry.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={size / 2 - strokeWidth / 2}
                  className={`${styles.segment} ${segment.className}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${geometry.visibleLength} ${circumference - geometry.visibleLength}`}
                  strokeDashoffset={-geometry.offset}
                />
              )
              return circle
            })
          : null}
      </svg>
    </span>
  )
}
