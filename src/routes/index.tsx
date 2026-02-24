import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useRef } from "react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { resolveUserAvatarUrl } from "@/lib/avatar"
import { shouldResumeInitialSync } from "@/lib/initial-sync"
import { parseStringArray, parseInitialSyncProgress } from "@/lib/json-validators"
import { RepoSection } from "@/features/repo/RepoSection"
import {
  InitialSyncCard,
  OverviewHeader,
  PRDashboard,
  ConnectGitHubCard,
  WebhookManagement,
} from "@/features/overview"
import styles from "@/pages/OverviewPage.module.css"

type RateLimitInfo = {
  remaining: number
  limit: number
  reset: Date
}

type OverviewSyncResponse = {
  error?: string
  code?: string
  rateLimit?: { remaining: number; limit: number; reset: string }
}

const startOverviewSync = async (userId: string): Promise<OverviewSyncResponse> => {
  const response = await fetch("/api/github/sync/overview", {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${userId}`,
    },
  })

  const data = (await response.json()) as OverviewSyncResponse

  if (!response.ok) {
    if (data.code === "auth_invalid") {
      throw new Error("Your GitHub connection has expired. Please reconnect to continue syncing.")
    }
    throw new Error(data.error || "Failed to sync")
  }

  return data
}

function OverviewPage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSyncManagement, setShowSyncManagement] = useState(false)
  const autoResumeAttemptedRef = useRef(false)

  // Check if GitHub was just connected or installed
  const githubJustConnected = search.github === "connected"
  const githubJustInstalled = search.github === "installed"
  const oauthError = search.error
  const oauthMessage = search.message
  const revokeUrl = search.revokeUrl

  const isGitHubConnected = Boolean(user?.login)

  const { data } = db.useQuery({
    syncStates: {},
    repos: {},
    organizations: {},
    pullRequests: {
      $: { where: { state: "open" } },
      repo: {},
    },
  })
  const syncStates = data?.syncStates ?? []
  const repos = data?.repos ?? []
  const organizations = data?.organizations ?? []
  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const initialSyncProgress = parseInitialSyncProgress(initialSyncState?.lastEtag)
  const isInitialSyncComplete = initialSyncState?.syncStatus === "completed"
  const isInitialSyncing = isGitHubConnected && !isInitialSyncComplete

  const tokenSyncState = syncStates.find((s) => s.resourceType === "github:token")
  const isAuthInvalid = tokenSyncState?.syncStatus === "auth_invalid"
  const shouldAutoResumeInitialSync =
    isGitHubConnected &&
    !isAuthInvalid &&
    !isInitialSyncComplete &&
    shouldResumeInitialSync(initialSyncState)

  const overviewSyncState = syncStates.find((s) => s.resourceType === "overview")
  const isSyncing = overviewSyncState?.syncStatus === "syncing"
  const syncError = overviewSyncState?.syncError
  const lastSyncedAt = overviewSyncState?.lastSyncedAt

  const currentUserLogin = user?.login ?? user?.email?.split("@")[0] ?? ""

  const authoredPRs = useMemo(() => {
    const prs = data?.pullRequests ?? []
    if (!currentUserLogin) return []
    return prs.filter((pr) => pr.authorLogin === currentUserLogin)
  }, [data?.pullRequests, currentUserLogin])

  const reviewRequestedPRs = useMemo(() => {
    const prs = data?.pullRequests ?? []
    if (!currentUserLogin) return []
    return prs.filter((pr) => parseStringArray(pr.reviewRequestedBy).includes(currentUserLogin))
  }, [data?.pullRequests, currentUserLogin])

  const orgs = organizations.filter(
    (org, index, self) => self.findIndex((o) => o.login === org.login) === index,
  )

  const hasSyncErrors = syncStates.some((state) => state.syncStatus === "error" || state.syncError)

  const handleSync = async () => {
    if (!user?.id) return
    setError(null)

    try {
      const data = await startOverviewSync(user.id)
      if (data.rateLimit) {
        setRateLimit({
          remaining: data.rateLimit.remaining,
          limit: data.rateLimit.limit,
          reset: new Date(data.rateLimit.reset),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    }
  }

  const handleResetSync = async (resourceType: string, resourceId?: string) => {
    try {
      const response = await fetch("/api/github/sync/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({ resourceType, resourceId }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || "Failed to reset sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset sync")
    }
  }

  const handleRetrySync = async (resourceType: string, resourceId?: string) => {
    try {
      const response = await fetch("/api/github/sync/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({ resourceType, resourceId }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || "Failed to retry sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry sync")
    }
  }

  const handleConnectGitHub = () => {
    if (!user?.id) return
    setError(null)

    const connectUrl = `/api/github/oauth?${new URLSearchParams({ userId: user.id }).toString()}`
    if (!isGitHubConnected) {
      window.location.href = connectUrl
      return
    }

    void (async () => {
      try {
        const response = await fetch("/api/github/oauth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.id}`,
          },
          body: JSON.stringify({ userId: user.id }),
        })

        if (!response.ok) {
          let errorMessage = "Failed to prepare GitHub reconnect"
          try {
            const payload = (await response.json()) as { error?: string }
            errorMessage = payload.error || errorMessage
          } catch {
            errorMessage = `Reconnect request failed (${response.status})`
          }
          throw new Error(errorMessage)
        }

        window.location.href = connectUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to prepare GitHub reconnect")
      }
    })()
  }

  useEffect(() => {
    if (!shouldAutoResumeInitialSync) {
      autoResumeAttemptedRef.current = false
      return
    }
    if (autoResumeAttemptedRef.current) return
    autoResumeAttemptedRef.current = true
    if (!user?.id) return

    void (async () => {
      try {
        setError(null)
        const data = await startOverviewSync(user.id)
        if (data.rateLimit) {
          setRateLimit({
            remaining: data.rateLimit.remaining,
            limit: data.rateLimit.limit,
            reset: new Date(data.rateLimit.reset),
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync")
      }
    })()
  }, [shouldAutoResumeInitialSync, user?.id])

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <OverviewHeader
        isGitHubConnected={isGitHubConnected}
        isAuthInvalid={isAuthInvalid}
        isSyncing={isSyncing}
        rateLimit={rateLimit}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        githubJustConnected={githubJustConnected}
        oauthError={oauthError}
        revokeUrl={revokeUrl}
        error={error}
        onSync={() => void handleSync()}
        onConnectGitHub={handleConnectGitHub}
        showSyncManagement={showSyncManagement}
        onToggleSyncManagement={() => setShowSyncManagement(!showSyncManagement)}
        hasSyncErrors={hasSyncErrors && !isInitialSyncing}
      />

      {!isGitHubConnected && (
        <ConnectGitHubCard
          onConnect={handleConnectGitHub}
          justInstalled={githubJustInstalled}
          message={oauthMessage}
        />
      )}

      {isInitialSyncing && (
        <InitialSyncCard
          progress={initialSyncProgress}
          syncStates={syncStates}
          onResetSync={(type, id) => void handleResetSync(type, id)}
          onRetrySync={(type, id) => void handleRetrySync(type, id)}
        />
      )}

      {isGitHubConnected && isInitialSyncComplete && showSyncManagement && (
        <WebhookManagement repos={repos} userId={user.id} />
      )}

      <PRDashboard authoredPRs={authoredPRs} reviewRequestedPRs={reviewRequestedPRs} />

      <RepoSection
        repos={repos}
        orgs={orgs}
        currentUserLogin={currentUserLogin || undefined}
        currentUserAvatarUrl={resolveUserAvatarUrl(user)}
      />
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: OverviewPage,
  validateSearch: (search: Record<string, string | number | boolean | null | undefined>) => ({
    github: search.github as string | undefined,
    error: search.error as string | undefined,
    message: search.message as string | undefined,
    revokeUrl: search.revokeUrl as string | undefined,
  }),
})
