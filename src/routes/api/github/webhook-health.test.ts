import { describe, expect, it } from "vitest"
import { deriveWebhookQueueHealth } from "./webhook-health"

describe("deriveWebhookQueueHealth", () => {
  it("returns ok when queue is healthy", () => {
    const now = Date.now()
    const snapshot = deriveWebhookQueueHealth(
      [
        { status: "processed", createdAt: now - 20_000, processedAt: now - 10_000 },
        { status: "pending", createdAt: now - 1_000 },
      ],
      now,
    )

    expect(snapshot.health).toBe("ok")
    expect(snapshot.alerts).toHaveLength(0)
  })

  it("returns warning for moderate backlog", () => {
    const now = Date.now()
    const pendingItems = Array.from({ length: 1_100 }, (_, index) => ({
      status: "pending",
      createdAt: now - index * 1000,
    }))
    const items = [
      ...pendingItems,
      { status: "processed", createdAt: now - 30_000, processedAt: now - 10_000 },
    ]

    const snapshot = deriveWebhookQueueHealth(items, now)
    expect(snapshot.health).toBe("warning")
    expect(snapshot.alerts.some((alert) => alert.code === "pending_backlog_warning")).toBe(true)
  })

  it("returns critical when processor is stale and dead-letter growth spikes", () => {
    const now = Date.now()
    const deadLetters = Array.from({ length: 120 }, (_, index) => ({
      status: "dead_letter",
      createdAt: now - 60_000,
      failedAt: now - index * 1000,
    }))

    const snapshot = deriveWebhookQueueHealth(deadLetters, now)
    expect(snapshot.health).toBe("critical")
    expect(snapshot.alerts.some((alert) => alert.code === "dead_letter_critical")).toBe(true)
    expect(snapshot.alerts.some((alert) => alert.code === "processor_stale_critical")).toBe(true)
  })
})
