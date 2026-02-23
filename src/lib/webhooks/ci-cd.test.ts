import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WebhookDB, WebhookPayload } from "./types"

vi.mock("@instantdb/admin", () => ({
  id: vi.fn(() => `mock-check-${Date.now()}-${Math.random()}`),
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

vi.mock("./utils", () => ({
  findUserBySender: vi.fn().mockResolvedValue("user-1"),
  ensureRepoFromWebhook: vi.fn().mockResolvedValue({
    id: "repo-1",
    fullName: "owner/repo",
    userId: "user-1",
  }),
}))

import {
  handleCheckRunWebhook,
  handleCheckSuiteWebhook,
  handleStatusWebhook,
  handleWorkflowRunWebhook,
  handleWorkflowJobWebhook,
} from "./ci-cd"

const makeCheckRunPayload = (overrides = {}) => ({
  action: "completed",
  check_run: {
    id: 12345,
    name: "test-suite",
    head_sha: "abc123",
    status: "completed",
    conclusion: "success",
    external_id: "ext-1",
    details_url: "https://example.com",
    html_url: "https://github.com/check/1",
    started_at: "2025-01-01T00:00:00Z",
    completed_at: "2025-01-01T00:01:00Z",
    ...overrides,
  },
  repository: {
    id: 100,
    full_name: "owner/repo",
    name: "repo",
    owner: { login: "owner" },
  },
  sender: { id: 1, login: "user" },
})

const makeCheckSuitePayload = (overrides = {}) => ({
  action: "completed",
  check_suite: {
    id: 67890,
    head_sha: "abc123",
    status: "completed",
    conclusion: "success",
    app: { name: "GitHub Actions" },
    ...overrides,
  },
  repository: {
    id: 100,
    full_name: "owner/repo",
    name: "repo",
    owner: { login: "owner" },
  },
  sender: { id: 1, login: "user" },
})

const makeStatusPayload = (overrides = {}) => ({
  id: 11111,
  sha: "abc123",
  state: "success",
  context: "ci/tests",
  target_url: "https://ci.example.com",
  description: "All tests passed",
  repository: {
    id: 100,
    full_name: "owner/repo",
    name: "repo",
    owner: { login: "owner" },
  },
  sender: { id: 1, login: "user" },
  ...overrides,
})

const makeWorkflowRunPayload = (overrides = {}) => ({
  action: "completed",
  workflow_run: {
    id: 22222,
    name: "CI",
    head_sha: "abc123",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/actions/runs/1",
    path: ".github/workflows/ci.yml",
    run_number: 42,
    run_attempt: 1,
    run_started_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:05:00Z",
    ...overrides,
  },
  repository: {
    id: 100,
    full_name: "owner/repo",
    name: "repo",
    owner: { login: "owner" },
  },
  sender: { id: 1, login: "user" },
})

const makeWorkflowJobPayload = (overrides = {}) => ({
  action: "completed",
  workflow_job: {
    id: 33333,
    name: "build",
    head_sha: "abc123",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/actions/jobs/1",
    workflow_name: "CI",
    started_at: "2025-01-01T00:00:00Z",
    completed_at: "2025-01-01T00:02:00Z",
    ...overrides,
  },
  repository: {
    id: 100,
    full_name: "owner/repo",
    name: "repo",
    owner: { login: "owner" },
  },
  sender: { id: 1, login: "user" },
})

describe("handleCheckRunWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ repos: [{ id: "repo-1" }], prChecks: [], pullRequests: [] })
  })

  it("processes a check_run event", async () => {
    await handleCheckRunWebhook(mockDb, makeCheckRunPayload() as unknown as WebhookPayload)
    expect(mockTransact).toHaveBeenCalled()
  })

  it("skips when no repo and sender not registered", async () => {
    mockQuery.mockResolvedValue({ repos: [], prChecks: [], pullRequests: [] })
    const { findUserBySender } = await import("./utils")
    vi.mocked(findUserBySender).mockResolvedValueOnce(null)

    await handleCheckRunWebhook(mockDb, makeCheckRunPayload() as unknown as WebhookPayload)
  })

  it("handles missing check_run gracefully", async () => {
    await handleCheckRunWebhook(mockDb, {
      repository: { full_name: "x" },
    } as unknown as WebhookPayload)
  })
})

describe("handleCheckSuiteWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ repos: [{ id: "repo-1" }], prChecks: [], pullRequests: [] })
  })

  it("processes a check_suite event", async () => {
    await handleCheckSuiteWebhook(mockDb, makeCheckSuitePayload() as unknown as WebhookPayload)
    expect(mockTransact).toHaveBeenCalled()
  })
})

describe("handleStatusWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ repos: [{ id: "repo-1" }], prChecks: [], pullRequests: [] })
  })

  it("processes a status event with success state", async () => {
    await handleStatusWebhook(mockDb, makeStatusPayload() as unknown as WebhookPayload)
    expect(mockTransact).toHaveBeenCalled()
  })

  it("processes a status event with pending state", async () => {
    await handleStatusWebhook(
      mockDb,
      makeStatusPayload({ state: "pending" }) as unknown as WebhookPayload,
    )
    expect(mockTransact).toHaveBeenCalled()
  })

  it("processes a status event with failure state", async () => {
    await handleStatusWebhook(
      mockDb,
      makeStatusPayload({ state: "failure" }) as unknown as WebhookPayload,
    )
    expect(mockTransact).toHaveBeenCalled()
  })
})

describe("handleWorkflowRunWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ repos: [{ id: "repo-1" }], prChecks: [], pullRequests: [] })
  })

  it("processes a workflow_run event", async () => {
    await handleWorkflowRunWebhook(mockDb, makeWorkflowRunPayload() as unknown as WebhookPayload)
    expect(mockTransact).toHaveBeenCalled()
  })
})

describe("handleWorkflowJobWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ repos: [{ id: "repo-1" }], prChecks: [], pullRequests: [] })
  })

  it("processes a workflow_job event", async () => {
    await handleWorkflowJobWebhook(mockDb, makeWorkflowJobPayload() as unknown as WebhookPayload)
    expect(mockTransact).toHaveBeenCalled()
  })
})

describe("unknown events do not break processing", () => {
  it("handles missing repository gracefully in check_run", async () => {
    await handleCheckRunWebhook(mockDb, { check_run: { id: 1 } } as unknown as WebhookPayload)
  })

  it("handles missing sha gracefully in status", async () => {
    await handleStatusWebhook(mockDb, {
      repository: { full_name: "x" },
    } as unknown as WebhookPayload)
  })
})
