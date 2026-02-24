import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WebhookDB } from "./types"

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
    id: "repo-1",
    fullName: "owner/repo",
    userId: "user-1",
  }),
  syncPRDetailsForWebhook: vi.fn().mockResolvedValue(undefined),
}))

const mockQuery = vi.fn()
const mockTransact = vi.fn().mockResolvedValue(undefined)
const mockUpdate = vi.fn().mockReturnValue({})

const mockDbBase = {
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
}
const mockDb = mockDbBase as never as WebhookDB

import { handlePullRequestWebhook } from "./pull-request"
import { syncPRDetailsForWebhook } from "./utils"

describe("handlePullRequestWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("syncs mergeable state and lock state from webhook payload", async () => {
    mockQuery
      .mockResolvedValueOnce({
        repos: [{ id: "repo-1", userId: "user-1" }],
      })
      .mockResolvedValueOnce({
        pullRequests: [{ id: "pr-1" }],
      })

    await handlePullRequestWebhook(mockDb, {
      action: "synchronize",
      repository: {
        full_name: "owner/repo",
      },
      sender: {
        login: "sender",
      },
      pull_request: {
        id: 1001,
        number: 42,
        title: "Improve checks panel",
        body: "PR body",
        state: "open",
        draft: false,
        merged: false,
        locked: true,
        active_lock_reason: "resolved",
        mergeable: false,
        mergeable_state: "dirty",
        user: {
          login: "author",
          avatar_url: "https://example.com/avatar.png",
        },
        head: {
          ref: "feature/checks",
          sha: "abc123",
        },
        base: {
          ref: "main",
          sha: "def456",
        },
        html_url: "https://github.com/owner/repo/pull/42",
        diff_url: "https://github.com/owner/repo/pull/42.diff",
        additions: 12,
        deletions: 3,
        changed_files: 2,
        commits: 1,
        comments: 0,
        review_comments: 0,
        labels: [],
        requested_reviewers: [],
        requested_teams: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:01:00Z",
        closed_at: null,
        merged_at: null,
      },
    })

    expect(mockTransact).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        mergeable: false,
        mergeableState: "dirty",
        locked: true,
        lockReason: "resolved",
      }),
    )
    expect(syncPRDetailsForWebhook).toHaveBeenCalledWith(
      mockDb,
      "user-1",
      "owner",
      "repo",
      42,
      expect.objectContaining({
        event: "pull_request",
        action: "synchronize",
      }),
    )
  })
})
