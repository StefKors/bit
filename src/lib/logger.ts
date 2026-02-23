/**
 * Structured logger for server-side operations.
 * Adds context (operation, resource, user) to every log line
 * so errors are traceable without digging through stack traces.
 */

type LogContext = Record<string, unknown>

const formatContext = (ctx: LogContext): string => {
  const parts: string[] = []
  for (const [key, value] of Object.entries(ctx)) {
    if (value === undefined || value === null) continue
    parts.push(`${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
  }
  return parts.join(" ")
}

const formatError = (error: unknown): { message: string; status?: number; code?: string } => {
  if (error instanceof Error) {
    const result: { message: string; status?: number; code?: string } = {
      message: error.message,
    }
    if ("status" in error) result.status = (error as { status: number }).status
    if ("code" in error) result.code = (error as { code: string }).code
    return result
  }
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>
    return {
      message: String(obj.message ?? obj.type ?? "Unknown error"),
      status: typeof obj.status === "number" ? obj.status : undefined,
    }
  }
  return { message: String(error) }
}

export const log = {
  info: (message: string, ctx: LogContext = {}) => {
    const ctxStr = formatContext(ctx)
    console.log(`[info] ${message}${ctxStr ? ` | ${ctxStr}` : ""}`)
  },

  warn: (message: string, ctx: LogContext = {}) => {
    const ctxStr = formatContext(ctx)
    console.warn(`[warn] ${message}${ctxStr ? ` | ${ctxStr}` : ""}`)
  },

  error: (message: string, error: unknown, ctx: LogContext = {}) => {
    const err = formatError(error)
    const allCtx = { ...ctx, error: err.message, status: err.status, code: err.code }
    const ctxStr = formatContext(allCtx)
    console.error(`[error] ${message} | ${ctxStr}`)
  },
}

export { formatError, formatContext }
