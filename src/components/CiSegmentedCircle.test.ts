import { describe, expect, it } from "vitest"
import { buildSegmentGeometry } from "./CiSegmentedCircleMath"

describe("buildSegmentGeometry", () => {
  it("returns empty geometry when no segments are active", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "pending", count: 0 },
        { key: "failed", count: 0 },
      ],
      circumference: 100,
      segmentGap: 2,
      strokeWidth: 2,
      minSegmentWidth: 0,
    })

    expect(geometry).toEqual([])
  })

  it("applies two gaps for two segments (including wrap boundary)", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "pending", count: 1 },
        { key: "failed", count: 1 },
      ],
      circumference: 100,
      segmentGap: 2,
      strokeWidth: 3,
      minSegmentWidth: 0,
    })

    expect(geometry).toHaveLength(2)
    expect(geometry[0].rawLength).toBeCloseTo(45)
    expect(geometry[0].visibleLength).toBeCloseTo(45)
    expect(geometry[1].visibleLength).toBeCloseTo(45)
    expect(geometry[1].offset).toBeCloseTo(50)
  })

  it("uses full circumference when only one segment is active", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "successful", count: 4 },
        { key: "failed", count: 0 },
      ],
      circumference: 100,
      segmentGap: 6,
      strokeWidth: 4,
      minSegmentWidth: 12,
    })

    expect(geometry).toHaveLength(1)
    expect(geometry[0]).toMatchObject({
      key: "successful",
      rawLength: 100,
      visibleLength: 100,
      offset: 0,
    })
  })

  it("enforces minimum visible width using gap-aware value", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "small", count: 1 },
        { key: "large", count: 9 },
      ],
      circumference: 100,
      segmentGap: 2,
      strokeWidth: 2,
      minSegmentWidth: 10,
    })

    expect(geometry[0].visibleLength).toBeCloseTo(10)
    expect(geometry[1].visibleLength).toBeGreaterThanOrEqual(10)
  })

  it("falls back to uniform distribution when min width cannot fit", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "a", count: 1 },
        { key: "b", count: 1 },
        { key: "c", count: 1 },
      ],
      circumference: 30,
      segmentGap: 2,
      strokeWidth: 2,
      minSegmentWidth: 20,
    })

    expect(geometry).toHaveLength(3)
    expect(geometry[0].visibleLength).toBeCloseTo(30 / 3 - ((2 + 2) * 3) / 3)
    expect(geometry[1].visibleLength).toBeCloseTo(30 / 3 - ((2 + 2) * 3) / 3)
    expect(geometry[2].visibleLength).toBeCloseTo(30 / 3 - ((2 + 2) * 3) / 3)
  })

  it("builds offsets from raw segment lengths", () => {
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "first", count: 1 },
        { key: "second", count: 2 },
      ],
      circumference: 90,
      segmentGap: 0,
      strokeWidth: 0,
      minSegmentWidth: 0,
    })

    expect(geometry[0].offset).toBeCloseTo(0)
    expect(geometry[1].offset).toBeCloseTo(30)
  })

  it("guarantees effective minimum width for each active segment", () => {
    const segmentGap = 3
    const strokeWidth = 2
    const minSegmentWidth = 12
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "tinyA", count: 1 },
        { key: "tinyB", count: 1 },
        { key: "large", count: 18 },
      ],
      circumference: 120,
      segmentGap,
      strokeWidth,
      minSegmentWidth,
    })

    expect(geometry).toHaveLength(3)
    for (const segment of geometry) {
      expect(segment.visibleLength).toBeGreaterThanOrEqual(minSegmentWidth)
    }
  })

  it("builds offsets from adjusted visible lengths when min width redistributes", () => {
    const segmentGap = 2
    const strokeWidth = 2
    const gap = segmentGap + strokeWidth
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "small", count: 1 },
        { key: "large", count: 9 },
      ],
      circumference: 100,
      segmentGap,
      strokeWidth,
      minSegmentWidth: 20,
    })

    expect(geometry).toHaveLength(2)
    expect(geometry[0].visibleLength).toBeCloseTo(20)
    expect(geometry[1].offset).toBeCloseTo(geometry[0].visibleLength + gap)
  })

  it("keeps a consistent total gap budget including wrap boundary", () => {
    const segmentGap = 2
    const strokeWidth = 2
    const geometry = buildSegmentGeometry({
      segments: [
        { key: "one", count: 2 },
        { key: "two", count: 3 },
        { key: "three", count: 5 },
      ],
      circumference: 200,
      segmentGap,
      strokeWidth,
      minSegmentWidth: 0,
    })

    const totalVisible = geometry.reduce((sum, segment) => sum + segment.visibleLength, 0)
    const gapBudget = geometry.length * (segmentGap + strokeWidth)
    expect(totalVisible + gapBudget).toBeCloseTo(200)
    expect(geometry[1].offset - geometry[0].offset - geometry[0].rawLength).toBeCloseTo(
      segmentGap + strokeWidth,
    )
    expect(geometry[2].offset - geometry[1].offset - geometry[1].rawLength).toBeCloseTo(
      segmentGap + strokeWidth,
    )
  })
})
