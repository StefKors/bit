import { expect, test } from "vitest"
import type { ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { page } from "vitest/browser"
import { CiSegmentedCircle } from "./CiSegmentedCircle"

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const mountIcon = (props: ComponentProps<typeof CiSegmentedCircle>) => {
  document.body.innerHTML = ""
  const host = document.createElement("div")
  host.setAttribute("data-testid", "ci-vrt-host")
  host.style.padding = "12px"
  host.style.display = "inline-flex"
  host.style.background = "rgb(255, 255, 255)"
  document.body.appendChild(host)

  const root = createRoot(host)
  root.render(<CiSegmentedCircle {...props} />)
  return { host, root }
}

test("renders all successful segments", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 0,
    failedCount: 0,
    skippedCount: 0,
    successfulCount: 1,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-all-successful.png")
  root.unmount()
})

test("renders all two equal segments", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 1,
    failedCount: 0,
    skippedCount: 0,
    successfulCount: 1,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-two-equal-segments.png")
  root.unmount()
})

test("renders all three equal segments", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 1,
    failedCount: 1,
    skippedCount: 0,
    successfulCount: 1,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-three-equal-segments.png")
  root.unmount()
})

test("renders all four equal segments", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 1,
    failedCount: 1,
    skippedCount: 1,
    successfulCount: 1,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-four-equal-segments.png")
  root.unmount()
})

test("renders all five equal segments", async () => {
  const { host, root } = mountIcon({
    pendingCount: 1,
    inProgressCount: 1,
    failedCount: 1,
    skippedCount: 1,
    successfulCount: 1,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-five-equal-segments.png")
  root.unmount()
})

test("renders minimum size segments correctly", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 0,
    failedCount: 1,
    skippedCount: 0,
    successfulCount: 40,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 4,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-min-size-segments.png")
  root.unmount()
})

test("renders zero minimum size segments correctly", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 0,
    failedCount: 1,
    skippedCount: 0,
    successfulCount: 40,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 0,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-zero-min-size-segments.png")
  root.unmount()
})

test("renders segmented circle without overlap", async () => {
  const { host, root } = mountIcon({
    pendingCount: 1,
    inProgressCount: 2,
    failedCount: 1,
    skippedCount: 1,
    successfulCount: 3,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-default.png")
  root.unmount()
})

test("keeps tiny segment visible with minimum width", async () => {
  const { host, root } = mountIcon({
    pendingCount: 0,
    inProgressCount: 0,
    failedCount: 1,
    skippedCount: 0,
    successfulCount: 40,
    size: 28,
    strokeWidth: 4,
    segmentGap: 4,
    minSegmentWidth: 12,
  })

  await nextFrame()
  await expect
    .element(page.getByTestId("ci-vrt-host"))
    .toMatchScreenshot("ci-segmented-circle-min-width.png")
  root.unmount()
})
