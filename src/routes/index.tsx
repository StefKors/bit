import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import {
  ClockIcon,
  SyncIcon,
  SignOutIcon,
  MarkGithubIcon,
  CheckCircleIcon,
  CheckCircleFillIcon,
  CircleIcon,
} from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { Button } from "@/components/Button"
import { RepoSection } from "@/features/repo/RepoSection"
import { PRListItem } from "@/features/pr/PRListItem"
import styles from "@/pages/OverviewPage.module.css"
import { Avatar } from "@/components/Avatar"

interface RateLimitInfo {
  remaining: number
  limit: number
  reset: Date
}

interface InitialSyncProgress {
  step: "orgs" | "repos" | "webhooks" | "pullRequests" | "completed"
  orgs?: { total: number }
  repos?: { total: number }
  webhooks?: { completed: number; total: number }
  pullRequests?: { completed: number; total: number; prsFound: number }
  error?: string
}

type SyncStepStatus = "completed" | "active" | "pending"

const SyncStepItem = ({
  label,
  status,
  count,
}: {
  label: string
  status: SyncStepStatus
  count?: string
}) => {
  const iconClass =
    status === "completed"
      ? styles.syncStepIconCompleted
      : status === "active"
        ? styles.syncStepIconActive
        : styles.syncStepIconPending

  const labelClass =
    status === "active"
      ? styles.syncStepLabelActive
      : status === "pending"
        ? styles.syncStepLabelPending
        : styles.syncStepLabel

  return (
    <div className={styles.syncStep}>
      <div className={`${styles.syncStepIcon} ${iconClass}`}>
        {status === "completed" ? (
          <CheckCircleFillIcon size={16} />
        ) : status === "active" ? (
          <SyncIcon size={16} />
        ) : (
          <CircleIcon size={16} />
        )}
      </div>
      <span className={labelClass}>{label}</span>
      {count && <span className={styles.syncStepCount}>{count}</span>}
    </div>
  )
}

const InitialSyncProgressCard = ({ progress }: { progress: InitialSyncProgress | null }) => {
  const steps = ["orgs", "repos", "webhooks", "pullRequests"] as const
  const stepIndex = progress ? steps.indexOf(progress.step as (typeof steps)[number]) : 0
  const totalSteps = steps.length
  const progressPercent =
    progress?.step === "completed" ? 100 : ((stepIndex + 0.5) / totalSteps) * 100

  const getStepStatus = (step: string): SyncStepStatus => {
    if (!progress) return step === "orgs" ? "active" : "pending"
    if (progress.step === "completed") return "completed"
    const currentIndex = steps.indexOf(progress.step)
    const stepIdx = steps.indexOf(step as (typeof steps)[number])
    if (stepIdx < currentIndex) return "completed"
    if (stepIdx === currentIndex) return "active"
    return "pending"
  }

  const getStepCount = (step: string): string | undefined => {
    if (!progress) return undefined
    switch (step) {
      case "orgs":
        return progress.orgs ? `${progress.orgs.total} found` : undefined
      case "repos":
        return progress.repos ? `${progress.repos.total} found` : undefined
      case "webhooks":
        return progress.webhooks
          ? `${progress.webhooks.completed}/${progress.webhooks.total}`
          : undefined
      case "pullRequests":
        return progress.pullRequests
          ? `${progress.pullRequests.completed}/${progress.pullRequests.total} repos · ${progress.pullRequests.prsFound} PRs`
          : undefined
      default:
        return undefined
    }
  }

  return (
    <div className={styles.initialSyncCard}>
      <div className={styles.initialSyncHeader}>
        <SyncIcon size={20} className={styles.initialSyncSpinner} />
        <h2 className={styles.initialSyncTitle}>Setting up your workspace</h2>
      </div>
      <p className={styles.initialSyncDescription}>
        We're syncing your GitHub data. This only happens once.
      </p>
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className={styles.syncSteps}>
        <SyncStepItem
          label="Syncing organizations"
          status={getStepStatus("orgs")}
          count={getStepCount("orgs")}
        />
        <SyncStepItem
          label="Syncing repositories"
          status={getStepStatus("repos")}
          count={getStepCount("repos")}
        />
        <SyncStepItem
          label="Registering webhooks"
          status={getStepStatus("webhooks")}
          count={getStepCount("webhooks")}
        />
        <SyncStepItem
          label="Syncing open pull requests"
          status={getStepStatus("pullRequests")}
          count={getStepCount("pullRequests")}
        />
      </div>
    </div>
  )
}

function OverviewPage() {
  const { user } = db.useAuth()
  const search = useSearch({ from: "/" })
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const formatLastSynced = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp * 1000
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (diff < 60000) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

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
  const currentUserLogin = user?.email?.split("@")[0] ?? ""
  const { data: prsData } = db.useQuery({
    pullRequests: {
      $: { where: { state: "open" } },
      repo: {},
    },
  })
  const allOpenPRs = prsData?.pullRequests ?? []

  // Filter authored PRs client-side
  const authoredPRs = useMemo(() => {
    if (!currentUserLogin) return []
    return allOpenPRs.filter((pr) => pr.authorLogin === currentUserLogin)
  }, [allOpenPRs, currentUserLogin])

  // Filter review-requested PRs: check if current user is in reviewRequestedBy JSON array
  const reviewRequestedPRs = useMemo(() => {
    if (!currentUserLogin) return []
    return allOpenPRs.filter((pr) => {
      if (!pr.reviewRequestedBy) return false
      try {
        const reviewers = JSON.parse(pr.reviewRequestedBy) as string[]
        return reviewers.includes(currentUserLogin)
      } catch {
        return false
      }
    })
  }, [allOpenPRs, currentUserLogin])

  const orgs = repos
    .map((repo) => repo.organization)
    .filter((org): org is NonNullable<typeof org> => org !== null && org !== undefined)
    .filter((org, index, self) => self.findIndex((o) => o.id === org.id) === index)

  const handleSync = async () => {
    setError(null)

    try {
      const response = await fetch("/api/github/sync/overview", {
        method: "POST",
        credentials: "include",
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

  const handleSignOut = () => {
    void db.auth.signOut()
  }

  const handleConnectGitHub = () => {
    if (!user?.id) return
    window.location.href = `/api/github/oauth?userId=${user.id}`
  }

  if (!user) {
    return <div>Loading...</div>
  }

  const rateLimitLow = rateLimit && rateLimit.remaining < 100

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar src={(user as { avatarUrl?: string }).avatarUrl} name={user.email} size={48} />
          <h1 className={styles.title}>
            {isGitHubConnected
              ? `@${(user as { login?: string }).login}'s`
              : user.email?.split("@")[0] + "'s"}{" "}
            Pull Requests
          </h1>
        </div>

        <div className={styles.headerActions}>
          {rateLimit && (
            <div className={`${styles.rateLimit} ${rateLimitLow ? styles.rateLimitLow : ""}`}>
              <ClockIcon className={styles.buttonIcon} size={16} />
              {rateLimit.remaining}/{rateLimit.limit} requests
            </div>
          )}

          {isGitHubConnected ? (
            <Button
              variant="success"
              leadingIcon={<SyncIcon size={16} />}
              loading={isSyncing}
              disabled={isSyncing}
              onClick={() => void handleSync()}
            >
              {isSyncing ? "Syncing..." : "Sync GitHub"}
            </Button>
          ) : (
            <Button
              variant="primary"
              leadingIcon={<MarkGithubIcon size={16} />}
              onClick={handleConnectGitHub}
            >
              Connect GitHub
            </Button>
          )}

          <Button variant="danger" leadingIcon={<SignOutIcon size={16} />} onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      {githubJustConnected && (
        <div className={styles.successMessage}>
          <CheckCircleIcon size={16} />
          GitHub connected successfully! You can now sync your repositories.
        </div>
      )}

      {oauthError && <div className={styles.errorMessage}>{oauthError}</div>}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {isGitHubConnected && !isInitialSyncing && (
        <div className={styles.syncStatus}>
          {isSyncing ? (
            <div className={styles.syncStatusSyncing}>
              <SyncIcon size={16} className={styles.syncStatusIcon} />
              Syncing GitHub data...
            </div>
          ) : syncError ? (
            <div className={styles.syncStatusError}>Sync error: {syncError}</div>
          ) : lastSyncedAt ? (
            <div className={styles.syncStatusInfo}>
              <ClockIcon size={16} className={styles.syncStatusIcon} />
              Last synced {formatLastSynced(lastSyncedAt)}
            </div>
          ) : null}
        </div>
      )}

      {!isGitHubConnected && (
        <div className={styles.connectGitHubCard}>
          <MarkGithubIcon size={48} />
          <h2 className={styles.connectGitHubTitle}>Connect your GitHub account</h2>
          <p className={styles.connectGitHubDescription}>
            Connect your GitHub account to sync your repositories, pull requests, and receive
            real-time webhook updates.
          </p>
          <Button
            variant="primary"
            size="large"
            leadingIcon={<MarkGithubIcon size={20} />}
            onClick={handleConnectGitHub}
          >
            Connect GitHub
          </Button>
        </div>
      )}

      {isInitialSyncing && <InitialSyncProgressCard progress={initialSyncProgress} />}

      <section className={styles.prDashboard}>
        <div className={styles.prColumns}>
          <div className={styles.prColumn}>
            <h2 className={styles.prColumnTitle}>Authored by you</h2>
            <div className={styles.prList}>
              {authoredPRs.length === 0 ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>No open PRs authored by you.</p>
                </div>
              ) : (
                authoredPRs.map((pr) => (
                  <PRListItem
                    key={pr.id}
                    pr={{
                      number: pr.number,
                      title: pr.title,
                      state: pr.state as "open" | "closed",
                      draft: pr.draft ?? false,
                      merged: pr.merged ?? false,
                      authorLogin: pr.authorLogin,
                      authorAvatarUrl: pr.authorAvatarUrl,
                      comments: pr.comments ?? 0,
                      reviewComments: pr.reviewComments ?? 0,
                      githubCreatedAt: pr.githubCreatedAt,
                      githubUpdatedAt: pr.githubUpdatedAt,
                    }}
                    repoFullName={pr.repo?.fullName ?? ""}
                    isApproved={pr.merged === true}
                  />
                ))
              )}
            </div>
          </div>

          <div className={styles.prColumn}>
            <h2 className={styles.prColumnTitle}>Review requested</h2>
            <div className={styles.prList}>
              {reviewRequestedPRs.length === 0 ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>No PRs currently requesting your review.</p>
                </div>
              ) : (
                reviewRequestedPRs.map((pr) => (
                  <PRListItem
                    key={pr.id}
                    pr={{
                      number: pr.number,
                      title: pr.title,
                      state: pr.state as "open" | "closed",
                      draft: pr.draft ?? false,
                      merged: pr.merged ?? false,
                      authorLogin: pr.authorLogin,
                      authorAvatarUrl: pr.authorAvatarUrl,
                      comments: pr.comments ?? 0,
                      reviewComments: pr.reviewComments ?? 0,
                      githubCreatedAt: pr.githubCreatedAt,
                      githubUpdatedAt: pr.githubUpdatedAt,
                    }}
                    repoFullName={pr.repo?.fullName ?? ""}
                    isApproved={pr.merged === true}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

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
