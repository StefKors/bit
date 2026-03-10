interface SegmentInput {
  key: string
  count: number
}

interface SegmentGeometry {
  key: string
  rawLength: number
  visibleLength: number
  offset: number
}

interface SegmentGeometryParams {
  segments: SegmentInput[]
  circumference: number
  segmentGap: number
  strokeWidth: number
  minSegmentWidth: number
}

export const buildSegmentGeometry = ({
  segments,
  circumference,
  segmentGap,
  strokeWidth,
  minSegmentWidth,
}: SegmentGeometryParams): SegmentGeometry[] => {
  const activeSegments = segments.filter((segment) => segment.count > 0)
  const total = activeSegments.reduce((sum, segment) => sum + segment.count, 0)
  if (total <= 0) return []
  const segmentCount = activeSegments.length
  const effectiveGap = segmentGap + strokeWidth
  const gapCount = segmentCount > 1 ? segmentCount : 0
  const availableLength = Math.max(0, circumference - effectiveGap * gapCount)

  const rawLengths = activeSegments.map((segment) => (segment.count / total) * availableLength)
  const baseVisibleLengths = rawLengths.map((length) => Math.max(0, length))
  const totalVisibleBudget = baseVisibleLengths.reduce((sum, length) => sum + length, 0)
  const effectiveMinVisibleWidth = Math.max(0, minSegmentWidth)

  const computeVisibleLengths = (): number[] => {
    if (effectiveMinVisibleWidth <= 0) return baseVisibleLengths

    const activeCount = activeSegments.length
    if (totalVisibleBudget <= effectiveMinVisibleWidth * activeCount) {
      const uniformLength = totalVisibleBudget / activeCount
      return baseVisibleLengths.map(() => uniformLength)
    }

    const visible = [...baseVisibleLengths]
    const underMinIndexes = visible
      .map((length, index) => ({ length, index }))
      .filter(({ length }) => length < effectiveMinVisibleWidth)
      .map(({ index }) => index)

    if (underMinIndexes.length === 0) return visible

    const surplusIndexes = visible
      .map((length, index) => ({ length, index }))
      .filter(({ length }) => length > effectiveMinVisibleWidth)
      .map(({ index }) => index)

    const needed = underMinIndexes.reduce(
      (sum, index) => sum + (effectiveMinVisibleWidth - visible[index]),
      0,
    )
    const available = surplusIndexes.reduce(
      (sum, index) => sum + (visible[index] - effectiveMinVisibleWidth),
      0,
    )

    if (needed <= 0 || available <= 0) return visible

    for (const index of underMinIndexes) {
      visible[index] = effectiveMinVisibleWidth
    }

    for (const index of surplusIndexes) {
      const currentSurplus = visible[index] - effectiveMinVisibleWidth
      const reduction = (currentSurplus / available) * needed
      visible[index] = Math.max(effectiveMinVisibleWidth, visible[index] - reduction)
    }

    return visible
  }

  const visibleLengths = computeVisibleLengths()
  let offset = 0

  return activeSegments.map((segment, index) => {
    const geometry = {
      key: segment.key,
      rawLength: rawLengths[index],
      visibleLength: visibleLengths[index],
      offset,
    }
    offset += visibleLengths[index] + (segmentCount > 1 ? effectiveGap : 0)
    return geometry
  })
}
