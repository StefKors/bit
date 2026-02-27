import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { SyncIcon, LinkExternalIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { resolveUserAvatarUrl } from "@/lib/avatar"
import { parseInitialSyncProgress } from "@/lib/json-validators"
import { syncResetMutation, syncRetryMutation } from "@/lib/mutations"
import {
  buildActivityFeed,
  buildNextActions,
  getLanguageDistribution,
  getDailyActivityCounts,
  getGreeting,
  parseStringArray,
} from "@/lib/dashboard-utils"
import { Avatar } from "@/components/Avatar"
import { InitialSyncCard, ConnectGitHubCard } from "@/features/overview"
import {
  StatsGrid,
  ActivityFeed,
  NextActions,
  ContributionChart,
  LanguageBar,
  AISummary,
  PRTable,
  RepoList,
} from "@/features/dashboard"
import styles from "@/pages/DashboardPage.module.css"

type CenterTab = "activity" | "authored" | "reviews"

function DashboardPage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })
  const [centerTab, setCenterTab] = useState<CenterTab>("activity")
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; checked: boolean }>({
    configured: false,
    checked: false,
  })

  const resetSync = useMutation(syncResetMutation(user?.id ?? ""))
  const retrySync = useMutation(syncRetryMutation(user?.id ?? ""))

  const githubJustConnected = search.github === "connected"
  const githubJustInstalled = search.github === "installed"
  const oauthError = search.error
  const oauthMessage = search.message

  const isGitHubConnected = Boolean(user?.login)

  const { data } = db.useQuery({
    syncStates: {},
    repos: {
      pullRequests: {
        prReviews: {},
        prComments: {},
        prCommits: {},
        prChecks: {},
      },
      issues: {},
    },
    organizations: {},
    userSettings: {},
  })

  const syncStates = data?.syncStates ?? []
  const repos = data?.repos ?? []
  const userSettingsRecord = data?.userSettings?.[0] ?? null
  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const initialSyncProgress = parseInitialSyncProgress(initialSyncState?.lastEtag)
  const isInitialSyncComplete = initialSyncState?.syncStatus === "completed"
  const isInitialSyncing = isGitHubConnected && !isInitialSyncComplete

  const overviewSyncState = syncStates.find((s) => s.resourceType === "overview")
  const isSyncing = overviewSyncState?.syncStatus === "syncing"
  const lastSyncedAt = overviewSyncState?.lastSyncedAt

  const currentUserLogin = user?.login ?? user?.email?.split("@")[0] ?? ""
  const aiEnabled = userSettingsRecord?.aiEnabled !== false
  const aiModel = (userSettingsRecord?.aiModel as string) || "llama-4-scout-17b-16e"

  if (!aiStatus.checked) {
    setAiStatus({ configured: false, checked: true })
    void fetch("/api/cerebras/status")
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((d) => setAiStatus({ configured: d.configured, checked: true }))
      .catch(() => setAiStatus({ configured: false, checked: true }))
  }

  const dataRepos = data?.repos

  const allPRs = useMemo(() => {
    const repoList = dataRepos ?? []
    type RepoPR = (typeof repoList)[number]["pullRequests"][number]
    const prs: Array<RepoPR & { repo?: { fullName: string } }> = []
    for (const repo of repoList) {
      for (const pr of repo.pullRequests ?? []) {
        prs.push({ ...pr, repo: { fullName: repo.fullName } })
      }
    }
    return prs
  }, [dataRepos])

  const openPRs = useMemo(() => allPRs.filter((pr) => pr.state === "open"), [allPRs])

  const authoredPRs = useMemo(
    () => openPRs.filter((pr) => pr.authorLogin === currentUserLogin),
    [openPRs, currentUserLogin],
  )

  const reviewRequestedPRs = useMemo(
    () => openPRs.filter((pr) => parseStringArray(pr.reviewRequestedBy).includes(currentUserLogin)),
    [openPRs, currentUserLogin],
  )

  const activityFeed = useMemo(
    () => buildActivityFeed(dataRepos ?? [], currentUserLogin),
    [dataRepos, currentUserLogin],
  )

  const nextActions = useMemo(
    () => buildNextActions(dataRepos ?? [], currentUserLogin),
    [dataRepos, currentUserLogin],
  )

  const languages = useMemo(() => getLanguageDistribution(dataRepos ?? []), [dataRepos])

  const contributionData = useMemo(
    () => getDailyActivityCounts(dataRepos ?? [], currentUserLogin),
    [dataRepos, currentUserLogin],
  )

  const totalStars = useMemo(
    () => (dataRepos ?? []).reduce((sum, r) => sum + (r.stargazersCount ?? 0), 0),
    [dataRepos],
  )

  const totalCommits = useMemo(() => {
    let count = 0
    for (const repo of dataRepos ?? []) {
      for (const pr of repo.pullRequests ?? []) {
        for (const c of pr.prCommits ?? []) {
          if (c.authorLogin === currentUserLogin) count++
        }
      }
    }
    return count
  }, [dataRepos, currentUserLogin])

  const openIssues = useMemo(() => {
    let count = 0
    for (const repo of dataRepos ?? []) {
      for (const issue of repo.issues ?? []) {
        if (issue.state === "open") count++
      }
    }
    return count
  }, [dataRepos])

  const aiContextPrompt = useMemo(() => {
    const lines: string[] = []
    lines.push(`User: ${currentUserLogin}`)
    lines.push(`Repos tracked: ${repos.length}`)
    lines.push(`Open PRs authored: ${authoredPRs.length}`)
    lines.push(`Pending reviews: ${reviewRequestedPRs.length}`)
    lines.push(`Open issues: ${openIssues}`)

    const recentActivity = activityFeed.slice(0, 10)
    if (recentActivity.length > 0) {
      lines.push("\nRecent activity:")
      for (const item of recentActivity) {
        lines.push(`- ${item.title} (${item.subtitle})`)
      }
    }

    const urgentActions = nextActions.filter((a) => a.priority === "high").slice(0, 5)
    if (urgentActions.length > 0) {
      lines.push("\nUrgent items:")
      for (const action of urgentActions) {
        lines.push(`- ${action.title} (${action.subtitle})`)
      }
    }

    return lines.join("\n")
  }, [
    currentUserLogin,
    repos.length,
    authoredPRs.length,
    reviewRequestedPRs.length,
    openIssues,
    activityFeed,
    nextActions,
  ])

  const handleConnectGitHub = () => {
    if (!user?.id) return
    const connectUrl = `/api/github/oauth?${new URLSearchParams({ userId: user.id }).toString()}`
    window.location.href = connectUrl
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>
            {getGreeting()}, {user.name || user.login || "there"}
          </h1>
          <p className={styles.greetingSubtitle}>
            {repos.length} repositories &middot; {openPRs.length} open PRs &middot; {openIssues}{" "}
            issues
          </p>
        </div>
        <div className={styles.headerActions}>
          {isSyncing && (
            <span className={`${styles.syncBadge} ${styles.syncBadgeSyncing}`}>
              <SyncIcon size={12} className={styles.syncSpinner} />
              Syncing
            </span>
          )}
          {Boolean(lastSyncedAt) && !isSyncing && (
            <span className={styles.syncBadge}>
              <SyncIcon size={12} />
              Synced {formatRelativeTime(lastSyncedAt!)}
            </span>
          )}
        </div>
      </div>

      {/* OAuth messages */}
      {oauthError && <div className={`${styles.statusRow} ${styles.errorRow}`}>{oauthError}</div>}
      {githubJustConnected && (
        <div className={styles.statusRow}>GitHub connected successfully!</div>
      )}

      {/* Connect / Sync prompts */}
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
          onResetSync={(type, resId) => resetSync.mutate({ resourceType: type, resourceId: resId })}
          onRetrySync={(type, resId) => retrySync.mutate({ resourceType: type, resourceId: resId })}
        />
      )}

      {/* Stats row */}
      <StatsGrid
        openPRs={authoredPRs.length}
        pendingReviews={reviewRequestedPRs.length}
        totalRepos={repos.length}
        openIssues={openIssues}
        totalStars={totalStars}
        totalCommits={totalCommits}
      />

      {/* 3-column dashboard */}
      <div className={styles.columns}>
        {/* Left column */}
        <div className={styles.leftCol}>
          <div className={styles.profileCard}>
            <Avatar src={resolveUserAvatarUrl(user)} name={user.name || user.login} size={40} />
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user.name || user.login}</span>
              <span className={styles.profileLogin}>@{user.login || user.email}</span>
            </div>
            {user.htmlUrl && (
              <a
                href={user.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: "auto", color: "rgba(var(--bit-rgb-fg), 0.3)" }}
              >
                <LinkExternalIcon size={14} />
              </a>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Repositories</h2>
              <span className={styles.panelBadge}>{repos.length}</span>
            </div>
            <div className={styles.panelBody}>
              <RepoList repos={repos} maxItems={12} />
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Languages</h2>
            </div>
            <div className={styles.panelBodyPadded}>
              <LanguageBar languages={languages} />
            </div>
          </div>
        </div>

        {/* Center column */}
        <div className={styles.centerCol}>
          <div className={styles.panel}>
            <div className={styles.tabBar}>
              <button
                type="button"
                className={`${styles.tab} ${centerTab === "activity" ? styles.tabActive : ""}`}
                onClick={() => setCenterTab("activity")}
              >
                Activity
              </button>
              <button
                type="button"
                className={`${styles.tab} ${centerTab === "authored" ? styles.tabActive : ""}`}
                onClick={() => setCenterTab("authored")}
              >
                Your PRs ({authoredPRs.length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${centerTab === "reviews" ? styles.tabActive : ""}`}
                onClick={() => setCenterTab("reviews")}
              >
                Reviews ({reviewRequestedPRs.length})
              </button>
            </div>
            <div className={styles.panelBody}>
              {centerTab === "activity" && <ActivityFeed items={activityFeed} maxItems={20} />}
              {centerTab === "authored" && (
                <PRTable prs={authoredPRs} emptyText="No open PRs authored by you." />
              )}
              {centerTab === "reviews" && (
                <PRTable
                  prs={reviewRequestedPRs}
                  emptyText="No PRs currently requesting your review."
                />
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className={styles.rightCol}>
          <AISummary
            aiEnabled={aiEnabled}
            aiConfigured={aiStatus.configured}
            aiModel={aiModel}
            contextPrompt={aiContextPrompt}
          />

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Next Actions</h2>
              <span className={styles.panelBadge}>{nextActions.length}</span>
            </div>
            <div className={styles.panelBody}>
              <NextActions actions={nextActions} maxItems={8} />
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Contributions</h2>
            </div>
            <div className={styles.panelBodyPadded}>
              <ContributionChart data={contributionData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
  validateSearch: (search: Record<string, string | number | boolean | null | undefined>) => ({
    github: search.github as string | undefined,
    error: search.error as string | undefined,
    message: search.message as string | undefined,
    revokeUrl: search.revokeUrl as string | undefined,
  }),
})
