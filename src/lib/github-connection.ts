import { adminDb } from "./instantAdmin"
import { log } from "./logger"

type TokenSyncState = {
  id: string
  lastEtag?: string
  updatedAt?: number
}

export type RevokeGrantResult = {
  attempted: boolean
  revoked: boolean
  reason?: string
}

export const isReconnectRequest = (value: string | null): boolean => {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

export const getLatestAccessToken = (states: TokenSyncState[]): string | null => {
  const tokenStates = states.filter((state) => Boolean(state.lastEtag))
  if (tokenStates.length === 0) return null

  const latestState = tokenStates.reduce((latest, current) => {
    const latestUpdatedAt = latest.updatedAt ?? 0
    const currentUpdatedAt = current.updatedAt ?? 0
    return currentUpdatedAt > latestUpdatedAt ? current : latest
  })

  return latestState.lastEtag ?? null
}

export const revokeGitHubGrantForUser = async (userId: string): Promise<RevokeGrantResult> => {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    log.warn("Skipping GitHub grant revocation: OAuth credentials not configured", { userId })
    return { attempted: false, revoked: false, reason: "oauth_not_configured" }
  }

  let accessToken: string | null = null
  try {
    const { syncStates } = await adminDb.query({
      syncStates: {
        $: {
          where: {
            resourceType: "github:token",
            userId,
          },
        },
      },
    })

    const tokenStates = syncStates ?? []
    if (!Array.isArray(tokenStates)) {
      throw new Error("adminDb.query returned non-array syncStates")
    }
    accessToken = getLatestAccessToken(tokenStates)
  } catch (error) {
    log.error("Skipping GitHub grant revocation due to database error", error, { userId })
    return { attempted: true, revoked: false, reason: "db_error" }
  }

  if (!accessToken) {
    return { attempted: false, revoked: false, reason: "no_token" }
  }

  try {
    const basicAuth = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    const response = await fetch(`https://api.github.com/applications/${clientId}/grant`, {
      method: "DELETE",
      headers: {
        Authorization: basicAuth,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ access_token: accessToken }),
    })

    // 404/422 usually means the token is already invalidated or grant does not exist.
    if (response.ok || response.status === 404 || response.status === 422) {
      return { attempted: true, revoked: true }
    }

    log.warn("GitHub grant revocation failed", { userId, status: response.status })
    return { attempted: true, revoked: false, reason: `http_${response.status}` }
  } catch (error) {
    log.error("GitHub grant revocation request failed", error, { userId })
    return { attempted: true, revoked: false, reason: "request_failed" }
  }
}
