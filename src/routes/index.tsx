import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { resolveUserAvatarUrl } from "@/lib/avatar"
import { parseStringArray, parseInitialSyncProgress } from "@/lib/json-validators"
import { syncResetMutation, syncRetryMutation } from "@/lib/mutations"
import { RepoSection } from "@/features/repo/RepoSection"
import {
  InitialSyncCard,
  OverviewHeader,
  PRDashboard,
  ConnectGitHubCard,
} from "@/features/overview"
import styles from "@/pages/OverviewPage.module.css"

function OverviewPage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })

  const resetSync = useMutation(syncResetMutation(user?.id ?? ""))
  const retrySync = useMutation(syncRetryMutation(user?.id ?? ""))

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

  const error = resetSync.error?.message ?? retrySync.error?.message ?? null

  const handleConnectGitHub = () => {
    if (!user?.id) return

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
      } catch {
        // navigation will happen on success; errors are non-critical
      }
    })()
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <OverviewHeader
        isGitHubConnected={isGitHubConnected}
        isAuthInvalid={isAuthInvalid}
        isSyncing={isSyncing}
        rateLimit={null}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        githubJustConnected={githubJustConnected}
        oauthError={oauthError}
        revokeUrl={revokeUrl}
        error={error}
        onConnectGitHub={handleConnectGitHub}
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
          onResetSync={(type, resId) => {
            resetSync.mutate({ resourceType: type, resourceId: resId })
          }}
          onRetrySync={(type, resId) => {
            retrySync.mutate({ resourceType: type, resourceId: resId })
          }}
        />
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
