/**
 * Extracted API route handler logic for testability.
 * Each function takes the raw request/params and dependencies,
 * returns a Response. The actual route files delegate to these.
 */

import type { RateLimitInfo } from "./github-client"
import { log } from "./logger"

export const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const extractUserId = (request: Request): string => {
  const authHeader = request.headers.get("Authorization")
  return authHeader?.replace("Bearer ", "") || ""
}

// Shared error mapping for GitHub API errors
export const mapGitHubError = (error: unknown, context: string, ownerRepo?: string): Response => {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status
    if (status === 404) {
      return jsonResponse(
        {
          error: `${context} not found`,
          details: ownerRepo
            ? `Could not find ${ownerRepo}. It may not exist, be private, or your GitHub token may not have access.`
            : "The requested resource was not found.",
        },
        404,
      )
    }
    if (status === 403) {
      return jsonResponse(
        {
          error: "Access denied",
          details: "Rate limit exceeded or insufficient permissions to access this repository.",
        },
        403,
      )
    }
  }

  return jsonResponse(
    {
      error: `Failed to ${context.toLowerCase()}`,
      details: error instanceof Error ? error.message : "Unknown error",
    },
    500,
  )
}

export const authExpiredResponse = () =>
  jsonResponse(
    {
      error: "GitHub authentication expired",
      code: "auth_invalid",
      details: "Your GitHub token is no longer valid. Please reconnect your GitHub account.",
    },
    401,
  )

// ── Health handler ──

export const handleHealth = () =>
  jsonResponse({
    status: "ok",
    timestamp: new Date().toISOString(),
  })

// ── Rate limit handler ──

export interface RateLimitDeps {
  createClient: (userId: string) => Promise<{ getRateLimit: () => Promise<RateLimitInfo> } | null>
}

export const handleRateLimit = async (request: Request, deps: RateLimitDeps): Promise<Response> => {
  const userId = extractUserId(request)
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401)

  const client = await deps.createClient(userId)
  if (!client) return jsonResponse({ error: "GitHub account not connected" }, 400)

  try {
    const rateLimit = await client.getRateLimit()
    return jsonResponse({ rateLimit })
  } catch (error) {
    log.error("Failed to fetch rate limit", error, { userId })
    return jsonResponse({ error: "Failed to fetch rate limit" }, 500)
  }
}

// ── Sync handler (generic for tree/commits) ──

export interface SyncDeps {
  createClient: (userId: string) => Promise<{
    [method: string]: (
      owner: string,
      repo: string,
      ref?: string,
    ) => Promise<{ count: number; rateLimit: RateLimitInfo }>
  } | null>
  isAuthError: (error: unknown) => boolean
  handleAuthError: (userId: string) => Promise<void>
}

export const handleSync = async (
  request: Request,
  params: { owner: string; repo: string },
  syncMethod: string,
  deps: SyncDeps,
): Promise<Response> => {
  const userId = extractUserId(request)
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401)

  const { owner, repo } = params
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref") || undefined

  const client = await deps.createClient(userId)
  if (!client) return jsonResponse({ error: "GitHub account not connected" }, 400)

  try {
    const result = await client[syncMethod](owner, repo, ref)
    return jsonResponse({ count: result.count, rateLimit: result.rateLimit })
  } catch (error) {
    if (deps.isAuthError(error)) {
      await deps.handleAuthError(userId)
      return authExpiredResponse()
    }
    return mapGitHubError(
      error,
      `sync ${syncMethod.replace("fetch", "").toLowerCase()}`,
      `${owner}/${repo}`,
    )
  }
}
