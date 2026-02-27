const envInt = (key: string, fallback: number): number => {
  const val = typeof process !== "undefined" ? process.env[key] : undefined
  if (!val) return fallback
  const parsed = parseInt(val, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const SYNC_FRESHNESS_MS = envInt("SYNC_FRESHNESS_MS", 5 * 60 * 1000)
export const RATE_LIMIT_MAX_RETRIES = envInt("RATE_LIMIT_MAX_RETRIES", 3)
export const RATE_LIMIT_BASE_DELAY_MS = envInt("RATE_LIMIT_BASE_DELAY_MS", 1000)
export const TRANSACT_CHUNK_SIZE = envInt("TRANSACT_CHUNK_SIZE", 100)
export const WEBHOOK_REGISTRATION_CONCURRENCY = envInt("WEBHOOK_REGISTRATION_CONCURRENCY", 6)
export const INITIAL_SYNC_PR_CONCURRENCY = envInt("INITIAL_SYNC_PR_CONCURRENCY", 4)
export const WEBHOOK_MAX_ATTEMPTS = envInt("WEBHOOK_MAX_ATTEMPTS", 5)
export const WEBHOOK_BASE_DELAY_MS = envInt("WEBHOOK_BASE_DELAY_MS", 1000)
export const WEBHOOK_PROCESS_BATCH_SIZE = envInt("WEBHOOK_PROCESS_BATCH_SIZE", 50)
export const WEBHOOK_PROCESS_MAX_LOOPS = envInt("WEBHOOK_PROCESS_MAX_LOOPS", 20)
export const WEBHOOK_PROCESS_MAX_RUN_MS = envInt("WEBHOOK_PROCESS_MAX_RUN_MS", 15_000)
export const WEBHOOK_PROCESS_SELECTION_MULTIPLIER = envInt(
  "WEBHOOK_PROCESS_SELECTION_MULTIPLIER",
  5,
)
export const WEBHOOK_PROCESSING_TIMEOUT_MS = envInt("WEBHOOK_PROCESSING_TIMEOUT_MS", 10 * 60 * 1000)
export const WEBHOOK_CLEANUP_MAX_DELETE = envInt("WEBHOOK_CLEANUP_MAX_DELETE", 1000)
