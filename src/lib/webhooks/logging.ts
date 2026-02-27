/**
 * Webhook logging helpers.
 * Extracts payload summaries for structured logging of entity and data updates.
 */

import { log } from "@/lib/logger"

type PayloadSummary = {
  repo?: string
  pr?: number
  issue?: number
  ref?: string
  refType?: string
  action?: string
  sender?: string
  [key: string]: unknown
}

type WebhookTraceContext = {
  deliveryId?: string
  event?: string
  action?: string
  handler?: string
  entity?: string
  [key: string]: unknown
}

const formatWebhookTracePrefix = (depth: number): string => {
  if (depth <= 0) return "|-"
  return `${"|  ".repeat(depth)}|-`
}

function extractPayloadSummary(payload: unknown): PayloadSummary {
  if (!payload || typeof payload !== "object") return {}
  const p = payload as Record<string, unknown>
  const repo = p.repository as { full_name?: string } | undefined
  const pr = p.pull_request as { number?: number; id?: number } | undefined
  const issue = p.issue as { number?: number; pull_request?: unknown } | undefined
  const sender = p.sender as { login?: string } | undefined

  const summary: PayloadSummary = {
    repo: repo?.full_name,
    pr: pr?.number ?? (issue?.pull_request ? issue.number : undefined),
    issue: issue?.number,
    action: p.action as string | undefined,
    sender: sender?.login,
  }

  if ("ref" in p && typeof p.ref === "string") summary.ref = p.ref
  if ("ref_type" in p && typeof p.ref_type === "string") summary.refType = p.ref_type
  if ("commits" in p && Array.isArray(p.commits))
    summary.commitsCount = (p.commits as unknown[]).length

  return summary
}

export function logWebhookReceived(
  event: string,
  deliveryId: string | null,
  action: string | undefined,
  payload: unknown,
): void {
  const summary = extractPayloadSummary(payload)
  log.info("Webhook received", {
    op: "webhook-received",
    event,
    deliveryId,
    action,
    ...summary,
  })
}

export function logWebhookEnqueued(
  deliveryId: string,
  event: string,
  action: string | undefined,
  queueItemId: string,
): void {
  log.info("Webhook enqueued", {
    op: "webhook-enqueue",
    deliveryId,
    event,
    action,
    queueItemId,
  })
}

export function logWebhookProcessing(
  deliveryId: string,
  event: string,
  action: string | undefined,
  payload: unknown,
): void {
  const summary = extractPayloadSummary(payload)
  log.info("Processing webhook", {
    op: "webhook-process",
    deliveryId,
    event,
    action,
    ...summary,
  })
}

export function logWebhookHandler(
  event: string,
  handler: string,
  entities: string[],
  dataSummary: Record<string, unknown>,
): void {
  log.info("Webhook handler invoked", {
    op: "webhook-handler",
    event,
    handler,
    entities,
    ...dataSummary,
  })
}

export function logWebhookEntityUpdate(
  entity: string,
  operation: "create" | "update" | "delete",
  idOrIds: string | string[],
  dataSummary?: Record<string, unknown>,
): void {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
  log.info(`Webhook updating ${entity}`, {
    op: "webhook-entity-update",
    entity,
    operation,
    count: ids.length,
    ...(dataSummary ?? {}),
  })
}

/**
 * Emit a tree-style path log line for webhook processing flow.
 * Keep depth stable per handler path so logs are easy to scan.
 */
export function logWebhookPath(
  step: string,
  depth: number,
  context: WebhookTraceContext = {},
): void {
  log.info(`${formatWebhookTracePrefix(depth)} ${step}`, {
    op: "webhook-path",
    ...context,
  })
}
