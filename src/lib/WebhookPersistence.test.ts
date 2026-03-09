import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/InstantAdmin", () => ({
  adminDb: {
    query: vi.fn(),
    transact: vi.fn(),
    tx: {},
  },
}))

vi.mock("@/lib/Logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock("@/lib/GithubApp", () => ({
  extractInstallationId: vi.fn(),
}))

vi.mock("@/lib/GithubPrActivity", () => ({
  syncPRActivitySafely: vi.fn(),
}))

vi.mock("@/lib/GithubPrFiles", () => ({
  syncPRFiles: vi.fn(),
}))

import {
  buildCommitStatusKey,
  getHeadShaFromPayload,
  getPullRequestNumbers,
  getWorkflowRunIdFromPayload,
} from "./WebhookPersistence"

describe("WebhookPersistence helpers", () => {
  it("collects pull request numbers from root and nested CI payloads", () => {
    const numbers = getPullRequestNumbers({
      number: 42,
      issue: { number: 42 },
      pull_request: { number: 43 },
      check_run: {
        pull_requests: [{ number: 44 }, { number: 43 }],
      },
      check_suite: {
        pull_requests: [{ number: 45 }],
      },
      workflow_run: {
        pull_requests: [{ number: 46 }, { number: 44 }],
      },
    })

    expect(numbers).toEqual([42, 43, 44, 45, 46])
  })

  it("ignores invalid or non-positive pull request numbers", () => {
    const numbers = getPullRequestNumbers({
      number: -1,
      check_run: { pull_requests: [{ number: 0 }, { number: 12.2 }, { number: 10 }] },
      workflow_run: { pull_requests: [{ number: 10 }, { number: 11 }] },
    })

    expect(numbers).toEqual([10, 11])
  })

  it("reads head sha from supported payload shapes in fallback order", () => {
    expect(
      getHeadShaFromPayload({
        sha: "root-sha",
        workflow_run: { head_sha: "workflow-run-sha" },
      }),
    ).toBe("root-sha")

    expect(
      getHeadShaFromPayload({
        check_run: { check_suite: { head_sha: "suite-sha" } },
      }),
    ).toBe("suite-sha")

    expect(
      getHeadShaFromPayload({
        workflow_job: { head_sha: "job-sha" },
      }),
    ).toBe("job-sha")
  })

  it("extracts workflow run id from workflow_run and workflow_job payloads", () => {
    expect(getWorkflowRunIdFromPayload({ workflow_run: { id: 123 } })).toBe(123)
    expect(getWorkflowRunIdFromPayload({ workflow_job: { run_id: 456 } })).toBe(456)
    expect(getWorkflowRunIdFromPayload({})).toBeUndefined()
  })

  it("builds stable commit status keys", () => {
    const keyA = buildCommitStatusKey("abc123", "web-app / check")
    const keyB = buildCommitStatusKey("abc123", "web-app / check")
    const keyC = buildCommitStatusKey("abc123", "deploy")

    expect(keyA).toBe("abc123:web-app / check")
    expect(keyB).toBe(keyA)
    expect(keyC).not.toBe(keyA)
  })
})
