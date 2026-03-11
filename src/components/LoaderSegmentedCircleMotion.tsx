import { CiSegmentedCircle } from "./CiSegmentedCircle"
import styles from "./LoaderSegmentedCircleMotion.module.css"

type LoaderSegmentedCircleVariant = "breathe" | "throb" | "rotate" | "rotateReverse"
type SegmentCount = 4 | 5

interface LoaderSegmentedCircleMotionProps {
  size?: number
  variant?: LoaderSegmentedCircleVariant
  sections?: SegmentCount
}

const getSegmentCounts = (sections: SegmentCount) => {
  if (sections === 4) {
    return {
      pendingCount: 2,
      inProgressCount: 1,
      failedCount: 1,
      skippedCount: 0,
      successfulCount: 3,
    }
  }

  return {
    pendingCount: 1,
    inProgressCount: 2,
    failedCount: 1,
    skippedCount: 1,
    successfulCount: 2,
  }
}

export const LoaderSegmentedCircleMotion = ({
  size = 22,
  variant = "breathe",
  sections = 5,
}: LoaderSegmentedCircleMotionProps) => {
  const segmentCounts = getSegmentCounts(sections)

  return (
    <span className={`${styles.root} ${styles[variant]}`} aria-hidden="true">
      <CiSegmentedCircle
        pendingCount={segmentCounts.pendingCount}
        inProgressCount={segmentCounts.inProgressCount}
        failedCount={segmentCounts.failedCount}
        skippedCount={segmentCounts.skippedCount}
        successfulCount={segmentCounts.successfulCount}
        size={size}
        strokeWidth={2}
        segmentGap={2}
        animateSequential
        monochrome
      />
    </span>
  )
}
