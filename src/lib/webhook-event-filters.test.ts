import { describe, expect, it } from "vitest"
import { parseWebhookEventsEnabled } from "./webhook-event-filters"

describe("parseWebhookEventsEnabled", () => {
  it("returns null when setting is missing", () => {
    expect(parseWebhookEventsEnabled(undefined)).toBeNull()
    expect(parseWebhookEventsEnabled(null)).toBeNull()
    expect(parseWebhookEventsEnabled("")).toBeNull()
  })

  it("returns null for invalid payloads", () => {
    expect(parseWebhookEventsEnabled("not-json")).toBeNull()
    expect(parseWebhookEventsEnabled('{"events":[]}')).toBeNull()
  })

  it("returns empty set for [] so disable all works", () => {
    const result = parseWebhookEventsEnabled("[]")
    expect(result).toBeInstanceOf(Set)
    expect(result?.size).toBe(0)
  })

  it("keeps only string event names", () => {
    const result = parseWebhookEventsEnabled('["push",123,true,"issues"]')
    expect(result).toEqual(new Set(["push", "issues"]))
  })
})
