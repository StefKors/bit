import { beforeEach, describe, expect, it, vi } from "vitest"
import { logWebhookPath } from "./logging"

beforeEach(() => vi.restoreAllMocks())

describe("logWebhookPath", () => {
  it("logs root path step with webhook-path op", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})

    logWebhookPath("dispatch event", 0, {
      deliveryId: "d1",
      event: "workflow_job",
    })

    expect(spy).toHaveBeenCalledWith(
      "[info] |- dispatch event | op=webhook-path deliveryId=d1 event=workflow_job",
    )
  })

  it("logs nested path step with tree indentation", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})

    logWebhookPath("db upsert create -> prChecks", 2, {
      event: "workflow_job",
      entity: "prChecks",
    })

    expect(spy).toHaveBeenCalledWith(
      "[info] |  |  |- db upsert create -> prChecks | op=webhook-path event=workflow_job entity=prChecks",
    )
  })
})
