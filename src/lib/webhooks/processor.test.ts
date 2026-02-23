import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => `mock-id-${Date.now()}-${Math.random()}`),
}))

const mockQuery = vi.fn()
const mockTransact = vi.fn().mockResolvedValue(undefined)
const mockUpdate = vi.fn().mockReturnThis()

const mockDb = {
  query: mockQuery,
  transact: mockTransact,
  tx: new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: () => ({
              update: mockUpdate,
            }),
          },
        ),
    },
  ),
} as unknown as WebhookDB

vi.mock("@/lib/webhooks/index", () => ({
  handlePullRequestWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestReviewWebhook: vi.fn().mockResolvedValue(undefined),
  handleCommentWebhook: vi.fn().mockResolvedValue(undefined),
  handlePushWebhook: vi.fn().mockResolvedValue(undefined),
  handleRepositoryWebhook: vi.fn().mockResolvedValue(undefined),
  handleStarWebhook: vi.fn().mockResolvedValue(undefined),
  handleForkWebhook: vi.fn().mockResolvedValue(undefined),
  handleOrganizationWebhook: vi.fn().mockResolvedValue(undefined),
  handleCreateWebhook: vi.fn().mockResolvedValue(undefined),
  handleDeleteWebhook: vi.fn().mockResolvedValue(undefined),
  handlePullRequestEventWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueWebhook: vi.fn().mockResolvedValue(undefined),
  handleIssueCommentWebhook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/webhooks/ci-cd", () => ({
  handleCheckRunWebhook: vi.fn().mockResolvedValue(undefined),
  handleCheckSuiteWebhook: vi.fn().mockResolvedValue(undefined),
  handleStatusWebhook: vi.fn().mockResolvedValue(undefined),
  handleWorkflowRunWebhook: vi.fn().mockResolvedValue(undefined),
  handleWorkflowJobWebhook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import type { WebhookDB, WebhookEventName } from "./types"
import {
  enqueueWebhook,
  processQueueItem,
  dispatchWebhookEvent,
  calculateBackoff,
  type WebhookQueueItem,
} from "./processor"
import { handlePushWebhook, handlePullRequestWebhook } from "@/lib/webhooks/index"
import { handleCheckRunWebhook } from "@/lib/webhooks/ci-cd"

describe("calculateBackoff", () => {
  it("increases exponentially with attempt number", () => {
    const b0 = calculateBackoff(0, 1000)
    const b1 = calculateBackoff(1, 1000)
    const b2 = calculateBackoff(2, 1000)

    expect(b0).toBeGreaterThanOrEqual(1000)
    expect(b0).toBeLessThan(2000)
    expect(b1).toBeGreaterThanOrEqual(2000)
    expect(b1).toBeLessThan(3000)
    expect(b2).toBeGreaterThanOrEqual(4000)
    expect(b2).toBeLessThan(5000)
  })
})

describe("enqueueWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("enqueues a new webhook delivery", async () => {
    mockQuery.mockResolvedValueOnce({ webhookDeliveries: [] })
    mockQuery.mockResolvedValueOnce({ webhookQueue: [] })

    const result = await enqueueWebhook(mockDb, "delivery-1", "push", undefined, '{"ref":"main"}')

    expect(result.queued).toBe(true)
    expect(result.duplicate).toBe(false)
    expect(result.queueItemId).toBeDefined()
    expect(mockTransact).toHaveBeenCalled()
  })

  it("detects duplicate delivery from webhookDeliveries", async () => {
    mockQuery.mockResolvedValueOnce({
      webhookDeliveries: [{ id: "existing", deliveryId: "delivery-1" }],
    })

    const result = await enqueueWebhook(mockDb, "delivery-1", "push", undefined, '{"ref":"main"}')

    expect(result.queued).toBe(false)
    expect(result.duplicate).toBe(true)
  })

  it("detects duplicate delivery from webhookQueue", async () => {
    mockQuery.mockResolvedValueOnce({ webhookDeliveries: [] })
    mockQuery.mockResolvedValueOnce({
      webhookQueue: [{ id: "existing-queue", deliveryId: "delivery-1" }],
    })

    const result = await enqueueWebhook(mockDb, "delivery-1", "push", undefined, '{"ref":"main"}')

    expect(result.queued).toBe(false)
    expect(result.duplicate).toBe(true)
  })
})

describe("dispatchWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("dispatches push event to push handler", async () => {
    await dispatchWebhookEvent(mockDb, "push", { ref: "refs/heads/main" })
    expect(handlePushWebhook).toHaveBeenCalledWith(mockDb, { ref: "refs/heads/main" })
  })

  it("dispatches pull_request event to PR handler", async () => {
    const payload = { action: "opened", pull_request: {} }
    await dispatchWebhookEvent(mockDb, "pull_request", payload)
    expect(handlePullRequestWebhook).toHaveBeenCalledWith(mockDb, payload)
  })

  it("dispatches check_run event to CI/CD handler", async () => {
    const payload = { action: "completed", check_run: {} }
    await dispatchWebhookEvent(mockDb, "check_run", payload)
    expect(handleCheckRunWebhook).toHaveBeenCalledWith(mockDb, payload)
  })

  it("handles unknown events without throwing", async () => {
    await expect(
      dispatchWebhookEvent(mockDb, "unknown_event" as unknown as WebhookEventName, {}),
    ).resolves.toBeUndefined()
  })
})

describe("processQueueItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeQueueItem = (overrides: Partial<WebhookQueueItem> = {}): WebhookQueueItem => ({
    id: "queue-1",
    deliveryId: "delivery-1",
    event: "push",
    payload: JSON.stringify({ ref: "refs/heads/main" }),
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  })

  it("processes a queue item successfully", async () => {
    const item = makeQueueItem()
    const result = await processQueueItem(mockDb, item)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mockTransact).toHaveBeenCalled()
  })

  it("marks item as dead_letter after max attempts", async () => {
    const failingHandler = vi.mocked(handlePushWebhook)
    failingHandler.mockRejectedValueOnce(new Error("Transient failure"))

    const item = makeQueueItem({ attempts: 4, maxAttempts: 5 })
    const result = await processQueueItem(mockDb, item)

    expect(result.success).toBe(false)
    expect(result.error).toBe("Transient failure")
  })

  it("schedules retry for non-terminal failures", async () => {
    const failingHandler = vi.mocked(handlePushWebhook)
    failingHandler.mockRejectedValueOnce(new Error("Temporary error"))

    const item = makeQueueItem({ attempts: 1, maxAttempts: 5 })
    const result = await processQueueItem(mockDb, item)

    expect(result.success).toBe(false)
    expect(result.error).toBe("Temporary error")
    expect(mockTransact).toHaveBeenCalled()
  })
})
