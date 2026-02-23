/**
 * GitHub OAuth scope checking and permission diagnostics.
 */

export const REQUIRED_SCOPES = ["repo", "read:org", "read:user", "user:email"] as const

export type ScopeStatus = "granted" | "missing"

export interface ScopeCheck {
  scope: string
  status: ScopeStatus
  description: string
}

export interface PermissionReport {
  scopes: ScopeCheck[]
  allGranted: boolean
  grantedScopes: string[]
  missingScopes: string[]
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  repo: "Access private and public repositories (required for org repos)",
  "read:org": "Read organization membership (required to see org repos)",
  "read:user": "Read user profile data",
  "user:email": "Access email addresses",
}

export const parseScopes = (scopeHeader: string | null | undefined): string[] => {
  if (!scopeHeader) return []
  return scopeHeader
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export const checkPermissions = (grantedScopes: string[]): PermissionReport => {
  const grantedSet = new Set(grantedScopes)

  const scopes: ScopeCheck[] = REQUIRED_SCOPES.map((scope) => ({
    scope,
    status: grantedSet.has(scope) ? "granted" : "missing",
    description: SCOPE_DESCRIPTIONS[scope] ?? scope,
  }))

  const missingScopes = scopes.filter((s) => s.status === "missing").map((s) => s.scope)

  return {
    scopes,
    allGranted: missingScopes.length === 0,
    grantedScopes,
    missingScopes,
  }
}
