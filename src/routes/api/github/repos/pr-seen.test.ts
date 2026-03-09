import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/InstantAdmin", () => ({
  adminDb: {
    auth: { verifyToken: vi.fn() },
    query: vi.fn(),
    transact: vi.fn(),
    tx: {},
  },
}))

import { parsePrSeenBody } from "./pr-seen"

describe("parsePrSeenBody", () => {
  it("parses valid payloads", () => {
    expect(parsePrSeenBody({ owner: "bit", repo: "repo", number: 12 })).toEqual({
      owner: "bit",
      repo: "repo",
      number: 12,
    })
  })

  it("rejects invalid payloads", () => {
    expect(parsePrSeenBody(null)).toBeNull()
    expect(parsePrSeenBody({})).toBeNull()
    expect(parsePrSeenBody({ owner: "bit", repo: "repo", number: "12" })).toBeNull()
  })
})
