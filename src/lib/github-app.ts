import { SignJWT, importPKCS8 } from "jose"
import { log } from "@/lib/logger"
import { adminDb } from "@/lib/instantAdmin"

const GITHUB_APP_ID = process.env.GITHUB_APP_ID
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n")

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache = new Map<number, CachedToken>()
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

export const isGitHubAppConfigured = (): boolean => Boolean(GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY)

async function createAppJWT(): Promise<string> {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App not configured: missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY")
  }

  const privateKey = await importPKCS8(GITHUB_APP_PRIVATE_KEY, "RS256")
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 10 * 60)
    .setIssuer(GITHUB_APP_ID)
    .sign(privateKey)
}

interface InstallationTokenResponse {
  token: string
  expires_at: string
}

export async function getInstallationToken(installationId: number): Promise<string | null> {
  const cached = tokenCache.get(installationId)
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cached.token
  }

  try {
    const jwt = await createAppJWT()
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    )

    if (!response.ok) {
      const body = await response.text()
      log.error("Failed to get installation token", `HTTP ${response.status}: ${body}`, {
        installationId,
      })
      return null
    }

    const data = (await response.json()) as InstallationTokenResponse
    const expiresAt = new Date(data.expires_at).getTime()

    tokenCache.set(installationId, { token: data.token, expiresAt })

    return data.token
  } catch (err) {
    log.error("Failed to get installation token", err, { installationId })
    return null
  }
}

export async function getInstallationIdForUser(userId: string): Promise<number | null> {
  const { syncStates } = await adminDb.query({
    syncStates: {
      $: {
        where: {
          resourceType: "github:installation",
          userId,
        },
      },
    },
  })

  const state = syncStates?.[0]
  if (!state?.resourceId) return null

  const parsed = Number.parseInt(state.resourceId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export async function storeInstallationId(userId: string, installationId: string): Promise<void> {
  const { syncStates } = await adminDb.query({
    syncStates: {
      $: {
        where: {
          resourceType: "github:installation",
          userId,
        },
      },
    },
  })

  const existingId = syncStates?.[0]?.id
  const stateId = existingId ?? crypto.randomUUID()
  const now = Date.now()

  await adminDb.transact(
    adminDb.tx.syncStates[stateId]
      .update({
        resourceType: "github:installation",
        resourceId: installationId,
        syncStatus: "idle",
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .link({ user: userId }),
  )
}

interface InstallationAccount {
  login: string
  id: number
  avatar_url: string
  html_url: string
  type?: string
}

interface InstallationResponse {
  id: number
  account: InstallationAccount
}

export async function getInstallationAccount(
  installationId: number,
): Promise<{ login: string; githubId: number; avatarUrl: string; htmlUrl: string } | null> {
  try {
    const jwt = await createAppJWT()
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    if (!response.ok) {
      const body = await response.text()
      log.error("Failed to get installation", `HTTP ${response.status}: ${body}`, {
        installationId,
      })
      return null
    }
    const data = (await response.json()) as InstallationResponse
    const account = data.account
    if (!account?.login) return null
    return {
      login: account.login,
      githubId: account.id,
      avatarUrl: account.avatar_url ?? "",
      htmlUrl: account.html_url ?? "",
    }
  } catch (err) {
    log.error("Failed to get installation account", err, { installationId })
    return null
  }
}

// payload is untrusted JSON from webhook - unknown is appropriate
// eslint-disable-next-line @typescript-eslint/no-restricted-types
export function extractInstallationId(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null
  const installation = (payload as { installation?: { id?: number } }).installation
  if (!installation || typeof installation.id !== "number") return null
  return installation.id
}
