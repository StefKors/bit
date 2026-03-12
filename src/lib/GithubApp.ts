import { createPrivateKey } from "node:crypto"
import { SignJWT, importPKCS8 } from "jose"
import { log } from "@/lib/Logger"
import { adminDb } from "@/lib/InstantAdmin"

const GITHUB_APP_ID = process.env.GITHUB_APP_ID
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n")
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache = new Map<number, CachedToken>()
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

/** GitHub generates PKCS#1 keys (RSA PRIVATE KEY); jose expects PKCS#8 (PRIVATE KEY). */
function toPKCS8IfNeeded(pem: string): string {
  if (pem.includes("-----BEGIN PRIVATE KEY-----")) {
    log.info("GitHub App key: using PKCS#8 format as-is")
    return pem
  }
  if (pem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    log.info("GitHub App key: converting PKCS#1 to PKCS#8")
    const key = createPrivateKey({ key: pem, format: "pem" })
    return key.export({ type: "pkcs8", format: "pem" })
  }
  log.warn("GitHub App key: unexpected format, attempting import anyway", {
    hasBeginMarker: pem.includes("-----BEGIN"),
    firstLine: pem.split("\n")[0] ?? "(empty)",
  })
  return pem
}

export const isGitHubAppConfigured = (): boolean => Boolean(GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY)

async function createAppJWT(): Promise<string> {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App not configured: missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY")
  }

  const keyPem = toPKCS8IfNeeded(GITHUB_APP_PRIVATE_KEY)
  const privateKey = await importPKCS8(keyPem, "RS256")
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
    log.info("GitHub App: using cached installation token", { installationId })
    return cached.token
  }

  try {
    log.info("GitHub App: creating JWT and fetching installation token", { installationId })
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
    const msg = err instanceof Error ? err.message : String(err)
    const isKeyError = msg.includes("pkcs8") || msg.includes("PKCS") || msg.includes("key")
    log.error("Failed to get installation token", err, {
      installationId,
      errorMessage: msg,
      hint: isKeyError
        ? "Key format: ensure GITHUB_APP_PRIVATE_KEY is valid PEM. GitHub uses PKCS#1 (RSA PRIVATE KEY); app auto-converts to PKCS#8. Check newlines (use \\n in env) and that the full key is present."
        : undefined,
    })
    return null
  }
}

function parseInstallationId(resourceId: string | undefined | null): number | null {
  if (!resourceId) return null
  const parsed = Number.parseInt(resourceId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Returns the first installation ID for a user.
 * Prefer `getInstallationIdForRepo` when a repo owner is known.
 */
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
  return parseInstallationId(state?.resourceId)
}

/**
 * Returns the installation ID whose account matches `repoOwner`.
 * Falls back to the first installation if no owner match is found.
 * `lastEtag` stores the GitHub account login for installation records.
 */
export async function getInstallationIdForRepo(
  userId: string,
  repoOwner: string,
): Promise<number | null> {
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

  if (!syncStates?.length) return null

  const ownerLower = repoOwner.toLowerCase()
  const match = syncStates.find((s) => s.lastEtag?.toLowerCase() === ownerLower)
  const state = match ?? syncStates[0]
  return parseInstallationId(state?.resourceId)
}

/** Returns all installation IDs for a user (for aggregating repos across accounts). */
export async function getAllInstallationIdsForUser(userId: string): Promise<number[]> {
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

  if (!syncStates?.length) return []

  return syncStates
    .map((s) => parseInstallationId(s.resourceId))
    .filter((id): id is number => id !== null)
}

/**
 * Stores a GitHub App installation for a user.
 * Multiple installations are supported (personal + org).
 * `accountLogin` is stored in `lastEtag` so we can route API calls
 * to the right installation based on repo owner.
 */
export async function storeInstallationId(
  userId: string,
  installationId: string,
  accountLogin?: string,
): Promise<void> {
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

  const existing = syncStates?.find((s) => s.resourceId === installationId)
  const stateId = existing?.id ?? crypto.randomUUID()
  const now = Date.now()

  await adminDb.transact(
    adminDb.tx.syncStates[stateId]
      .update({
        resourceType: "github:installation",
        resourceId: installationId,
        lastEtag: accountLogin ?? existing?.lastEtag ?? undefined,
        syncStatus: "idle",
        userId,
        createdAt: existing?.createdAt ?? now,
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

export function getGitHubOAuthClientId(): string | undefined {
  return GITHUB_CLIENT_ID
}

export async function exchangeCodeForUserToken(code: string): Promise<string | null> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    log.warn("GitHub OAuth: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET")
    return null
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  if (!response.ok) {
    log.warn("GitHub OAuth: token exchange failed", { status: response.status })
    return null
  }

  const data = (await response.json()) as { access_token?: string; error?: string }
  if (data.error || !data.access_token) {
    log.warn("GitHub OAuth: token exchange error", { error: data.error })
    return null
  }

  return data.access_token
}

export async function getUserGitHubToken(userId: string): Promise<string | null> {
  const { $users } = await adminDb.query({
    $users: { $: { where: { id: userId }, limit: 1 } },
  })
  const user = $users?.[0]
  return (user as { githubAccessToken?: string } | undefined)?.githubAccessToken ?? null
}
