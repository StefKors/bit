import { describe, expect, it } from "vitest"
import { selectWebhookQueueCleanupCandidates } from "./webhook-queue"

describe("selectWebhookQueueCleanupCandidates", () => {
  it("selects only expired processed/dead_letter items up to maxDelete", () => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const result = selectWebhookQueueCleanupCandidates(
      [
        {
          id: "p-old",
          status: "processed",
          createdAt: now - 20 * day,
          processedAt: now - 10 * day,
        },
        { id: "p-new", status: "processed", createdAt: now - 2 * day, processedAt: now - day },
        {
          id: "dl-old",
          status: "dead_letter",
          createdAt: now - 40 * day,
          failedAt: now - 35 * day,
        },
        { id: "dl-new", status: "dead_letter", createdAt: now - 10 * day, failedAt: now - 5 * day },
      ],
      now,
      1,
    )

    expect(result.matched).toBe(2)
    expect(result.processedCandidates).toBe(1)
    expect(result.deadLetterCandidates).toBe(1)
    expect(result.toDelete).toHaveLength(1)
    expect(result.toDelete[0]?.id).toBe("dl-old")
  })
})
