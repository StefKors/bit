import { z } from "zod/v4"

export const webhookHeadersSchema = z.object({
  event: z.string().min(1),
  delivery: z.string().min(1),
  signature: z.string().min(1),
})

export const webhookBasePayloadSchema = z.object({
  action: z.string().optional(),
  sender: z
    .object({
      id: z.number(),
      login: z.string(),
    })
    .optional(),
  repository: z
    .object({
      id: z.number(),
      full_name: z.string(),
      name: z.string(),
      owner: z.object({
        login: z.string(),
      }),
    })
    .optional(),
})

export type WebhookHeaders = z.infer<typeof webhookHeadersSchema>

export const validateWebhookHeaders = (
  headers: Headers,
): { valid: true; data: WebhookHeaders } | { valid: false; error: string } => {
  const raw = {
    event: headers.get("x-github-event") || "",
    delivery: headers.get("x-github-delivery") || "",
    signature: headers.get("x-hub-signature-256") || "",
  }

  const result = webhookHeadersSchema.safeParse(raw)
  if (!result.success) {
    return { valid: false, error: `Invalid webhook headers: ${result.error.message}` }
  }
  return { valid: true, data: result.data }
}

export const validateWebhookPayload = (
  payload: unknown,
):
  | { valid: true; data: z.infer<typeof webhookBasePayloadSchema> }
  | { valid: false; error: string } => {
  const result = webhookBasePayloadSchema.safeParse(payload)
  if (!result.success) {
    return { valid: false, error: `Invalid webhook payload: ${result.error.message}` }
  }
  return { valid: true, data: result.data }
}

export class GitHubRateLimitError extends Error {
  readonly retryAfterMs: number
  readonly remaining: number
  readonly resetAt: Date

  constructor(opts: { message?: string; retryAfterMs: number; remaining: number; resetAt: Date }) {
    super(opts.message ?? `GitHub rate limit exceeded. Retry after ${opts.retryAfterMs}ms`)
    this.name = "GitHubRateLimitError"
    this.retryAfterMs = opts.retryAfterMs
    this.remaining = opts.remaining
    this.resetAt = opts.resetAt
  }
}

export const isRateLimitError = (error: unknown): error is GitHubRateLimitError =>
  error instanceof GitHubRateLimitError

export const parseRateLimitHeaders = (
  headers: Headers,
): { remaining: number; resetAt: Date; retryAfterMs: number } | null => {
  const remaining = headers.get("x-ratelimit-remaining")
  const reset = headers.get("x-ratelimit-reset")

  if (remaining === null || reset === null) return null

  const remainingNum = parseInt(remaining, 10)
  const resetTimestamp = parseInt(reset, 10) * 1000
  const resetAt = new Date(resetTimestamp)
  const retryAfterMs = Math.max(0, resetTimestamp - Date.now())

  return { remaining: remainingNum, resetAt, retryAfterMs }
}

export type LenientDecodeResult<T> = {
  parsed: T[]
  skipped: Array<{ index: number; error: string; raw: unknown }>
}

export const lenientDecode = <T>(
  items: unknown[],
  schema: z.ZodType<T>,
): LenientDecodeResult<T> => {
  const parsed: T[] = []
  const skipped: Array<{ index: number; error: string; raw: unknown }> = []

  for (let i = 0; i < items.length; i++) {
    const result = schema.safeParse(items[i])
    if (result.success) {
      parsed.push(result.data)
    } else {
      skipped.push({
        index: i,
        error: result.error.message,
        raw: items[i],
      })
    }
  }

  return { parsed, skipped }
}
