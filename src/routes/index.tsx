import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
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

type InitialSyncProgress = {
  step: "orgs" | "repos" | "webhooks" | "pullRequests" | "completed"
  orgs?: { total: number }
  repos?: { total: number }
  webhooks?: { completed: number; total: number }
  pullRequests?: { completed: number; total: number; prsFound: number }
  error?: string
}

function OverviewPage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSyncManagement, setShowSyncManagement] = useState(false)

  // Check if GitHub was just connected
  const githubJustConnected = search.github === "connected"
  const oauthError = search.error

  // Check if user has GitHub connected by looking at their login field
  const isGitHubConnected = Boolean((user as { login?: string } | undefined)?.login)

  // Query sync states
  const { data: syncData } = db.useQuery({
    syncStates: {},
  })
  const syncStates = syncData?.syncStates ?? []

  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const initialSyncProgress = initialSyncState?.lastEtag
    ? (JSON.parse(initialSyncState.lastEtag) as InitialSyncProgress)
    : null
  const isInitialSyncComplete = initialSyncState?.syncStatus === "completed"
  const isInitialSyncing = isGitHubConnected && !isInitialSyncComplete

  const overviewSyncState = syncStates.find((s) => s.resourceType === "overview")
  const isSyncing = overviewSyncState?.syncStatus === "syncing"
  const syncError = overviewSyncState?.syncError
  const lastSyncedAt = overviewSyncState?.lastSyncedAt

  // Query repos with organizations using InstantDB
  const { data: reposData } = db.useQuery({
    repos: {
      organization: {},
    },
  })
  const repos = reposData?.repos ?? []

  // Query all open PRs with their repos
  const currentUserLogin = user?.login ?? user?.email?.split("@")[0] ?? ""
  const { data: prsData } = db.useQuery({
    pullRequests: {
      $: { where: { state: "open" } },
      repo: {},
    },
  })

  // Filter authored PRs client-side
  const authoredPRs = useMemo(() => {
    const allPRs = prsData?.pullRequests ?? []
    if (!currentUserLogin) return []
    return allPRs.filter((pr) => pr.authorLogin === currentUserLogin)
  }, [prsData?.pullRequests, currentUserLogin])

  // Filter review-requested PRs: check if current user is in reviewRequestedBy JSON array
  const reviewRequestedPRs = useMemo(() => {
    const allPRs = prsData?.pullRequests ?? []
    if (!currentUserLogin) return []
    return allPRs.filter((pr) => {
      if (!pr.reviewRequestedBy) return false
      try {
        const reviewers = JSON.parse(pr.reviewRequestedBy) as string[]
        return reviewers.includes(currentUserLogin)
      } catch {
        return false
      }
    })
  }, [prsData?.pullRequests, currentUserLogin])

  const orgs = repos
    .map((repo) => repo.organization)
    .filter((org): org is NonNullable<typeof org> => org !== null && org !== undefined)
    .filter((org, index, self) => self.findIndex((o) => o.id === org.id) === index)

  const hasSyncErrors = syncStates.some((state) => state.syncStatus === "error" || state.syncError)

  const handleSync = async () => {
    setError(null)

    try {
      const response = await fetch("/api/github/sync/overview", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${user?.id}`,
        },
      })

      const data = (await response.json()) as {
        error?: string
        rateLimit?: { remaining: number; limit: number; reset: string }
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync")
      }

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
    window.location.href = `/api/github/oauth?userId=${user.id}`
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <OverviewHeader
        user={{
          id: user.id,
          email: user.email,
          login: (user as { login?: string }).login,
          avatarUrl: (user as { avatarUrl?: string }).avatarUrl,
        }}
        isGitHubConnected={isGitHubConnected}
        isSyncing={isSyncing}
        rateLimit={rateLimit}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        githubJustConnected={githubJustConnected}
        oauthError={oauthError}
        error={error}
        onSync={() => void handleSync()}
        onConnectGitHub={handleConnectGitHub}
        showSyncManagement={showSyncManagement}
        onToggleSyncManagement={() => setShowSyncManagement(!showSyncManagement)}
        hasSyncErrors={hasSyncErrors && !isInitialSyncing}
      />

      {!isGitHubConnected && <ConnectGitHubCard onConnect={handleConnectGitHub} />}

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

      <RepoSection repos={repos} orgs={orgs} currentUserLogin={currentUserLogin || undefined} />
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: OverviewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    github: search.github as string | undefined,
    error: search.error as string | undefined,
  }),
})
