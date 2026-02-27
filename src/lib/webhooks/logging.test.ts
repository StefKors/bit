import { beforeEach, describe, expect, it, vi } from "vitest"
import { logWebhookPath, logWebhookQueueLifecycle } from "./logging"
import { log } from "@/lib/logger"

beforeEach(() => vi.restoreAllMocks())

describe("logWebhookPath", () => {
  it("logs root path step with webhook-path op", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {})

    logWebhookPath("dispatch event", 0, {
      deliveryId: "d1",
      event: "workflow_job",
    })

    expect(spy).toHaveBeenCalledWith("|- dispatch event", {
      op: "webhook-path",
      deliveryId: "d1",
      event: "workflow_job",
    })
  })

  it("logs nested path step with tree indentation", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {})

    logWebhookPath("db upsert create -> prChecks", 2, {
      event: "workflow_job",
      entity: "prChecks",
    })

    expect(spy).toHaveBeenCalledWith("|  |  |- db upsert create -> prChecks", {
      op: "webhook-path",
      event: "workflow_job",
      entity: "prChecks",
    })
  })
})

describe("logWebhookQueueLifecycle", () => {
  it("logs lifecycle step and context", () => {
    const spy = vi.spyOn(log, "info").mockImplementation(() => {})

    logWebhookQueueLifecycle("selected", {
      queueItemId: "q-1",
      deliveryId: "d-1",
      reason: "retry_not_due",
    })

    expect(spy).toHaveBeenCalledWith("queue:selected", {
      op: "webhook-queue-lifecycle",
      step: "selected",
      queueItemId: "q-1",
      deliveryId: "d-1",
      reason: "retry_not_due",
    })
  })
})
