import { describe, it, expect, vi, beforeEach } from "vitest"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/

// Mock adminDb before importing the module under test
const mockQuery = vi.fn()
vi.mock("./instantAdmin", () => ({
  adminDb: { query: (...args: unknown[]) => mockQuery(...args) },
}))

// Mock id() from @instantdb/admin
vi.mock("@instantdb/admin", () => ({
  id: () => "new-generated-uuid",
}))

const { findOrCreateSyncStateId } = await import("./sync-state")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("findOrCreateSyncStateId", () => {
  it("returns existing sync state ID when found", async () => {
    mockQuery.mockResolvedValue({
      syncStates: [{ id: "existing-state-id" }],
    })

    const result = await findOrCreateSyncStateId("tree", "user-1", "repo:main")

    expect(result).toBe("existing-state-id")
    expect(mockQuery).toHaveBeenCalledWith({
      syncStates: {
        $: {
          where: {
            resourceType: "tree",
            userId: "user-1",
            resourceId: "repo:main",
          },
        },
      },
    })
  })

  it("returns a new ID when no existing state found", async () => {
    mockQuery.mockResolvedValue({ syncStates: [] })

    const result = await findOrCreateSyncStateId("tree", "user-1", "repo:main")

    expect(result).toBe("new-generated-uuid")
  })

  it("returns a new ID when syncStates is undefined", async () => {
    mockQuery.mockResolvedValue({ syncStates: undefined })

    const result = await findOrCreateSyncStateId("tree", "user-1")

    expect(result).toBe("new-generated-uuid")
  })

  it("omits resourceId from query when not provided", async () => {
    mockQuery.mockResolvedValue({ syncStates: [] })

    await findOrCreateSyncStateId("overview", "user-1")

    expect(mockQuery).toHaveBeenCalledWith({
      syncStates: {
        $: {
          where: {
            resourceType: "overview",
            userId: "user-1",
          },
        },
      },
    })
  })

  it("includes resourceId in query when provided", async () => {
    mockQuery.mockResolvedValue({ syncStates: [] })

    await findOrCreateSyncStateId("tree", "user-1", "StefKors/bit:main")

    expect(mockQuery).toHaveBeenCalledWith({
      syncStates: {
        $: {
          where: {
            resourceType: "tree",
            userId: "user-1",
            resourceId: "StefKors/bit:main",
          },
        },
      },
    })
  })

  it("returns first match when multiple states exist", async () => {
    mockQuery.mockResolvedValue({
      syncStates: [{ id: "first-id" }, { id: "second-id" }],
    })

    const result = await findOrCreateSyncStateId("tree", "user-1")
    expect(result).toBe("first-id")
  })
})
