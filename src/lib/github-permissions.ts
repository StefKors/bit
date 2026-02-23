/**
 * GitHub OAuth scope checking and permission diagnostics.
 */

export const REQUIRED_SCOPES = [
  "repo",
  "read:org",
  "read:user",
  "user:email",
  "admin:repo_hook",
] as const
export const OAUTH_SCOPE_PARAM = REQUIRED_SCOPES.join(" ")

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
  "admin:repo_hook":
    "Manage repository webhooks (required to automatically register webhook events)",
}

export const parseScopes = (scopeHeader: string | null | undefined): string[] => {
  if (!scopeHeader) return []
  return [...new Set(scopeHeader.split(/[,\s]+/))].map((s) => s.trim()).filter(Boolean)
}

const SCOPE_IMPLICATIONS: Record<string, string[]> = {
  repo: [
    "repo:status",
    "repo_deployment",
    "public_repo",
    "repo:invite",
    "security_events",
    "admin:repo_hook",
    "write:repo_hook",
    "read:repo_hook",
  ],
  "admin:repo_hook": ["write:repo_hook", "read:repo_hook"],
  "write:repo_hook": ["read:repo_hook"],
  user: ["read:user", "user:email", "user:follow"],
  "admin:org": ["write:org", "read:org"],
  "write:org": ["read:org"],
}

const expandGrantedScopes = (grantedScopes: string[]): Set<string> => {
  const expanded = new Set(grantedScopes)
  const queue = [...grantedScopes]

  while (queue.length > 0) {
    const scope = queue.pop()
    if (!scope) continue
    const impliedScopes = SCOPE_IMPLICATIONS[scope] ?? []
    for (const impliedScope of impliedScopes) {
      if (expanded.has(impliedScope)) continue
      expanded.add(impliedScope)
      queue.push(impliedScope)
    }
  }

  return expanded
}

export const checkPermissions = (grantedScopes: string[]): PermissionReport => {
  const normalizedGrantedScopes = [
    ...new Set(grantedScopes.map((scope) => scope.trim()).filter(Boolean)),
  ]
  const effectiveScopeSet = expandGrantedScopes(normalizedGrantedScopes)

  const scopes: ScopeCheck[] = REQUIRED_SCOPES.map((scope) => ({
    scope,
    status: effectiveScopeSet.has(scope) ? "granted" : "missing",
    description: SCOPE_DESCRIPTIONS[scope] ?? scope,
  }))

  const missingScopes = scopes.filter((s) => s.status === "missing").map((s) => s.scope)

  return {
    scopes,
    allGranted: missingScopes.length === 0,
    grantedScopes: normalizedGrantedScopes,
    missingScopes,
  }
}
