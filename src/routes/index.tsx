import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { ClockIcon, SyncIcon, SignOutIcon, GitPullRequestIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
import { queries } from "@/db/queries"
import { RepoSection } from "@/features/repo/RepoSection"
import { PRListItem } from "@/features/pr/PRListItem"
import styles from "@/pages/OverviewPage.module.css"
import { Avatar } from "@/components/Avatar"

interface RateLimitInfo {
  remaining: number
  limit: number
  reset: Date
}

function OverviewPage() {
  const { data: session } = authClient.useSession()
  const [syncing, setSyncing] = useState(false)
  const [syncingPRs, setSyncingPRs] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [repos] = useQuery(queries.overview())

  // Dashboard PR queries
  const currentUserLogin = session?.user?.name ?? ""
  const [authoredPRs] = useQuery(queries.dashboardAuthored(currentUserLogin))
  const [allOpenPRs] = useQuery(queries.dashboardAllOpen())

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
    .map((repo) => repo.githubOrganization)
    .filter((org): org is NonNullable<typeof org> => org !== null && org !== undefined)
    .filter((org, index, self) => self.findIndex((o) => o.id === org.id) === index)

  const handleSync = async () => {
    setSyncing(true)
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
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncPRs = async () => {
    setSyncingPRs(true)
    setError(null)

    try {
      const response = await fetch("/api/github/sync/dashboard", {
        method: "POST",
        credentials: "include",
      })

      const data = (await response.json()) as {
        error?: string
        authoredCount?: number
        reviewRequestedCount?: number
        rateLimit?: { remaining: number; limit: number; reset: string }
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync PRs")
      }

      if (data.rateLimit) {
        setRateLimit({
          remaining: data.rateLimit.remaining,
          limit: data.rateLimit.limit,
          reset: new Date(data.rateLimit.reset),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync PRs")
    } finally {
      setSyncingPRs(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.reload()
  }

  if (!session) {
    return <div>Loading...</div>
  }

  const rateLimitLow = rateLimit && rateLimit.remaining < 100

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar src={session.user.image} name={session.user.name} size={48} />
          <h1 className={styles.title}>{session.user.name}'s Pull Requests</h1>
        </div>

        <div className={styles.headerActions}>
          {rateLimit && (
            <div className={`${styles.rateLimit} ${rateLimitLow ? styles.rateLimitLow : ""}`}>
              <ClockIcon className={styles.buttonIcon} size={16} />
              {rateLimit.remaining}/{rateLimit.limit} requests
            </div>
          )}

          <Button
            variant="success"
            leadingIcon={<SyncIcon size={16} />}
            loading={syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? "Syncing..." : "Sync GitHub"}
          </Button>

          <Button
            variant="default"
            leadingIcon={<GitPullRequestIcon size={16} />}
            loading={syncingPRs}
            onClick={() => void handleSyncPRs()}
          >
            {syncingPRs ? "Syncing..." : "Sync PRs"}
          </Button>

          <Button
            variant="danger"
            leadingIcon={<SignOutIcon size={16} />}
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </div>
      </header>

      {error && (
        <div
          style={{
            color: "#f85149",
            marginBottom: "1rem",
            padding: "1rem",
            background: "rgba(248, 81, 73, 0.1)",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      <section className={styles.prDashboard}>
        <div className={styles.prColumns}>
          <div className={styles.prColumn}>
            <h2 className={styles.prColumnTitle}>Authored by you</h2>
            <div className={styles.prList}>
              {authoredPRs.length === 0 ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>
                    {currentUserLogin
                      ? "No open PRs authored by you."
                      : 'Click "Sync PRs" to load your PRs.'}
                  </p>
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
                    repoFullName={pr.githubRepo?.fullName ?? ""}
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
                  <p className={styles.prEmptyText}>
                    {currentUserLogin
                      ? "No PRs currently requesting your review."
                      : 'Click "Sync PRs" to load your PRs.'}
                  </p>
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
                    repoFullName={pr.githubRepo?.fullName ?? ""}
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
})
