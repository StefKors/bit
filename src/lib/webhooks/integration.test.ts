import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@instantdb/admin", () => {
  let counter = 0
  return {
    id: vi.fn(() => `mock-id-${++counter}`),
  }
})

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

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

import type { WebhookDB } from "./types"
import {
  enqueueWebhook,
  processQueueItem,
  calculateBackoff,
  type WebhookQueueItem,
} from "./processor"
import { handlePushWebhook } from "@/lib/webhooks/index"

type QueryTableConfig = {
  $?: { where?: Record<string, unknown>; limit?: number }
}

const createMockDb = () => {
  const store: Record<string, Record<string, Record<string, unknown>>> = {
    webhookDeliveries: {},
    webhookQueue: {},
  }

  const mockQuery = vi.fn().mockImplementation((query: Record<string, QueryTableConfig>) => {
    const result: Record<string, unknown[]> = {}
    for (const table of Object.keys(query)) {
      const tableConfig = query[table]
      const where = tableConfig?.$?.where ?? {}
      const items = Object.values(store[table] ?? {})
      const filtered = items.filter((item) => {
        for (const [key, value] of Object.entries(where)) {
          if (key === "or") continue
          if (item[key] !== value) return false
        }
        return true
      })
      const limit = tableConfig?.$?.limit
      result[table] = limit !== undefined ? filtered.slice(0, limit) : filtered
    }
    return Promise.resolve(result)
  })

  const mockTransact = vi.fn().mockImplementation((txOrArray: unknown) => {
    const txs = Array.isArray(txOrArray) ? txOrArray : [txOrArray]
    for (const _tx of txs) {
      // no-op for mock
    }
    return Promise.resolve()
  })

  const mockDb = {
    query: mockQuery,
    transact: mockTransact,
    tx: new Proxy(
      {} as Record<string, Record<string, { update: (data: Record<string, unknown>) => unknown }>>,
      {
        get: (_target, table: string | symbol) =>
          new Proxy(
            {},
            {
              get: (_t, itemId: string | symbol) => ({
                update: (data: Record<string, unknown>) => {
                  const t = typeof table === "string" ? table : ""
                  const id = typeof itemId === "string" ? itemId : ""
                  if (!store[t]) store[t] = {}
                  store[t][id] = { id, ...data }
                  return { __table: t, __id: id, __data: data }
                },
              }),
            },
          ),
      },
    ),
  } as unknown as WebhookDB

  return { db: mockDb, store, mockQuery, mockTransact }
}

describe("Integration: Duplicate delivery idempotency", () => {
  it("rejects duplicate deliveries via webhookDeliveries", async () => {
    const { db, mockQuery } = createMockDb()

    mockQuery.mockResolvedValueOnce({ webhookDeliveries: [], webhookQueue: [] })
    mockQuery.mockResolvedValueOnce({ webhookQueue: [] })
    const first = await enqueueWebhook(db, "delivery-dup", "push", undefined, "{}")
    expect(first.queued).toBe(true)

    mockQuery.mockResolvedValueOnce({
      webhookDeliveries: [{ id: "d1", deliveryId: "delivery-dup" }],
    })
    const second = await enqueueWebhook(db, "delivery-dup", "push", undefined, "{}")
    expect(second.queued).toBe(false)
    expect(second.duplicate).toBe(true)
  })

  it("rejects duplicate deliveries via webhookQueue", async () => {
    const { db, mockQuery } = createMockDb()

    mockQuery.mockResolvedValueOnce({ webhookDeliveries: [] })
    mockQuery.mockResolvedValueOnce({
      webhookQueue: [{ id: "q1", deliveryId: "delivery-dup2" }],
    })
    const result = await enqueueWebhook(db, "delivery-dup2", "push", undefined, "{}")
    expect(result.queued).toBe(false)
    expect(result.duplicate).toBe(true)
  })
})

describe("Integration: Retry with eventual success", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("succeeds on retry after initial failure", async () => {
    const { db } = createMockDb()
    const handler = vi.mocked(handlePushWebhook)

    handler.mockRejectedValueOnce(new Error("Transient"))

    const item: WebhookQueueItem = {
      id: "q-retry",
      deliveryId: "d-retry",
      event: "push",
      payload: JSON.stringify({ ref: "refs/heads/main" }),
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const firstResult = await processQueueItem(db, item)
    expect(firstResult.success).toBe(false)

    handler.mockResolvedValueOnce(undefined)
    const retryItem = { ...item, attempts: 1, status: "failed" }
    const secondResult = await processQueueItem(db, retryItem)
    expect(secondResult.success).toBe(true)
  })
})

describe("Integration: Dead-letter after max attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("dead-letters after exhausting all retries", async () => {
    const { db, mockTransact } = createMockDb()
    const handler = vi.mocked(handlePushWebhook)
    handler.mockRejectedValue(new Error("Persistent failure"))

    const item: WebhookQueueItem = {
      id: "q-dl",
      deliveryId: "d-dl",
      event: "push",
      payload: JSON.stringify({ ref: "refs/heads/main" }),
      status: "failed",
      attempts: 4,
      maxAttempts: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const result = await processQueueItem(db, item)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Persistent failure")
    expect(mockTransact).toHaveBeenCalled()
  })
})

describe("Integration: Out-of-order event handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("processes events regardless of arrival order", async () => {
    const { db, mockQuery } = createMockDb()

    mockQuery.mockResolvedValue({ webhookDeliveries: [], webhookQueue: [] })

    const events = [
      { delivery: "d-3", event: "push", payload: '{"seq":3}' },
      { delivery: "d-1", event: "push", payload: '{"seq":1}' },
      { delivery: "d-2", event: "push", payload: '{"seq":2}' },
    ]

    for (const e of events) {
      const result = await enqueueWebhook(db, e.delivery, e.event, undefined, e.payload)
      expect(result.queued).toBe(true)
    }
  })
})

describe("Integration: Backoff calculation", () => {
  it("produces increasing delays", () => {
    const delays = [0, 1, 2, 3, 4].map((attempt) => calculateBackoff(attempt, 1000))

    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1] * 0.8)
    }
  })
})
