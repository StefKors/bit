import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WebhookDB, WebhookPayload } from "./types"

vi.mock("@instantdb/admin", () => {
  let counter = 0
  return {
    id: vi.fn(() => `event-id-${++counter}`),
  }
})

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("./utils", () => ({
  findUserBySender: vi.fn().mockResolvedValue("user-1"),
  ensureRepoFromWebhook: vi.fn().mockResolvedValue({
    id: "repo-auto",
    fullName: "acme/widgets",
    userId: "user-1",
  }),
  ensurePRFromWebhook: vi.fn().mockResolvedValue({
    id: "pr-auto",
    userId: "user-1",
  }),
}))

vi.mock("./organization", () => ({
  ensureOrgFromWebhook: vi.fn().mockResolvedValue({
    id: "org-auto",
    login: "acme",
  }),
}))

vi.mock("./issue", () => ({
  ensureIssueFromWebhook: vi.fn().mockResolvedValue({
    id: "issue-auto",
  }),
}))

import { handleExtendedWebhook } from "./extended"
import { ensureOrgFromWebhook } from "./organization"
import { ensureIssueFromWebhook } from "./issue"
import { ensurePRFromWebhook, ensureRepoFromWebhook } from "./utils"

type QueryTableConfig = {
  $?: { where?: Record<string, unknown>; limit?: number }
}

type DataRow = Record<string, unknown> & { id: string }
type Store = Record<string, Record<string, DataRow>>

const createMockDb = () => {
  const store: Store = {
    repos: {},
    organizations: {},
    prEvents: {},
  }

  const query = vi.fn().mockImplementation((queryConfig: Record<string, QueryTableConfig>) => {
    const result: Record<string, unknown[]> = {}

    for (const [table, tableConfig] of Object.entries(queryConfig)) {
      const where = tableConfig.$?.where ?? {}
      const limit = tableConfig.$?.limit
      const rows = Object.values(store[table] ?? {})
      const filtered = rows.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      )
      result[table] = typeof limit === "number" ? filtered.slice(0, limit) : filtered
    }

    return Promise.resolve(result)
  })

  const transact = vi.fn().mockImplementation((txInput: unknown) => {
    const txItems = Array.isArray(txInput) ? txInput : [txInput]
    for (const tx of txItems) {
      if (!tx || typeof tx !== "object") continue
    }
    return Promise.resolve()
  })

  const tx = new Proxy(
    {} as Record<
      string,
      Record<
        string,
        {
          update: (data: Record<string, unknown>) => Record<string, unknown>
          delete: () => Record<string, unknown>
        }
      >
    >,
    {
      get: (_target, table: string | symbol) => {
        const tableName = typeof table === "string" ? table : ""
        return new Proxy(
          {},
          {
            get: (_innerTarget, recordId: string | symbol) => {
              const id = typeof recordId === "string" ? recordId : ""

              return {
                update: (data: Record<string, unknown>) => {
                  if (!store[tableName]) {
                    store[tableName] = {}
                  }

                  store[tableName][id] = {
                    ...(store[tableName][id] || { id }),
                    ...data,
                    id,
                  }

                  const transaction = {
                    __op: "update",
                    __table: tableName,
                    __id: id,
                    __data: data,
                    __links: {} as Record<string, string>,
                    link: (links: Record<string, string>) => {
                      transaction.__links = {
                        ...transaction.__links,
                        ...links,
                      }
                      return transaction
                    },
                  }

                  return transaction
                },
                delete: () => {
                  if (store[tableName]) {
                    delete store[tableName][id]
                  }

                  return { __op: "delete", __table: tableName, __id: id }
                },
              }
            },
          },
        )
      },
    },
  )

  const db = { query, transact, tx } as unknown as WebhookDB

  return { db, store, query, transact }
}

describe("handleExtendedWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("syncs metadata for tracked repository events", async () => {
    const { db, store } = createMockDb()
    store.repos["repo-1"] = {
      id: "repo-1",
      fullName: "acme/widgets",
      userId: "user-1",
      name: "widgets",
    }

    const payload = {
      action: "published",
      sender: { id: 101, login: "acme-user" },
      repository: {
        id: 200,
        full_name: "acme/widgets",
        name: "widgets",
        owner: { login: "acme" },
        description: "Widget repository",
        private: false,
        fork: false,
        stargazers_count: 42,
        forks_count: 3,
        open_issues_count: 5,
        updated_at: "2026-01-10T10:00:00Z",
        pushed_at: "2026-01-11T11:00:00Z",
      },
    } as unknown as WebhookPayload

    await handleExtendedWebhook(db, payload, "public")

    expect(store.repos["repo-1"].stargazersCount).toBe(42)
    expect(store.repos["repo-1"].forksCount).toBe(3)
    expect(store.repos["repo-1"].openIssuesCount).toBe(5)
    expect(typeof store.repos["repo-1"].syncedAt).toBe("number")
    expect(ensureRepoFromWebhook).not.toHaveBeenCalled()
  })

  it("auto-tracks repository when not already tracked", async () => {
    const { db, store } = createMockDb()

    const payload = {
      action: "published",
      sender: { id: 101, login: "acme-user" },
      repository: {
        id: 200,
        full_name: "acme/widgets",
        name: "widgets",
        owner: { login: "acme" },
      },
    } as unknown as WebhookPayload

    await handleExtendedWebhook(db, payload, "release")

    expect(ensureRepoFromWebhook).toHaveBeenCalled()
    expect(store.repos["repo-auto"]).toBeDefined()
  })

  it("records prEvents for PR-scoped events", async () => {
    const { db, store, transact } = createMockDb()
    store.repos["repo-1"] = {
      id: "repo-1",
      fullName: "acme/widgets",
      userId: "user-1",
    }

    const payload = {
      action: "resolved",
      sender: { id: 101, login: "acme-user", avatar_url: "https://example.com/avatar.png" },
      repository: {
        id: 200,
        full_name: "acme/widgets",
        name: "widgets",
        owner: { login: "acme" },
      },
      pull_request: {
        id: 300,
        number: 12,
        title: "Thread handling",
      },
      thread: {
        id: 444,
      },
    } as unknown as WebhookPayload

    await handleExtendedWebhook(db, payload, "pull_request_review_thread")

    expect(ensurePRFromWebhook).toHaveBeenCalled()
    const prEvents = Object.values(store.prEvents)
    expect(prEvents).toHaveLength(1)
    expect(prEvents[0].eventType).toBe("pull_request_review_thread.resolved")
    expect(prEvents[0].pullRequestId).toBe("pr-auto")
    const transaction = transact.mock.calls[1]?.[0] as {
      __links?: Record<string, string>
    }
    expect(transaction.__links).toMatchObject({
      pullRequest: "pr-auto",
      user: "user-1",
    })
  })

  it("ensures issue tracking when issue payload is present", async () => {
    const { db, store } = createMockDb()
    store.repos["repo-1"] = {
      id: "repo-1",
      fullName: "acme/widgets",
      userId: "user-1",
    }

    const issuePayload = {
      id: 500,
      number: 31,
      title: "Issue from webhook",
    }

    const payload = {
      action: "created",
      sender: { id: 101, login: "acme-user" },
      repository: {
        id: 200,
        full_name: "acme/widgets",
        name: "widgets",
        owner: { login: "acme" },
      },
      issue: issuePayload,
    } as unknown as WebhookPayload

    await handleExtendedWebhook(db, payload, "discussion")

    expect(ensureIssueFromWebhook).toHaveBeenCalledWith(
      db,
      issuePayload,
      expect.objectContaining({ id: "repo-1" }),
    )
  })

  it("syncs organization metadata and supports org auto-tracking", async () => {
    const { db, store } = createMockDb()
    store.organizations["org-1"] = {
      id: "org-1",
      login: "acme",
    }

    const payload = {
      action: "edited",
      sender: { id: 101, login: "acme-user" },
      organization: {
        id: 700,
        login: "acme",
        name: "Acme Inc.",
        description: "Acme org",
      },
    } as unknown as WebhookPayload

    await handleExtendedWebhook(db, payload, "team")

    expect(store.organizations["org-1"].name).toBe("Acme Inc.")
    expect(typeof store.organizations["org-1"].syncedAt).toBe("number")
    expect(ensureOrgFromWebhook).not.toHaveBeenCalled()
  })
})
