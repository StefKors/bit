import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { ClockIcon, SyncIcon, SignOutIcon } from "@primer/octicons-react"
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

function OverviewPage() {
  const { user } = db.useAuth()
  const [syncing, setSyncing] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const handleSignOut = () => {
    db.auth.signOut()
  }

  if (!user) {
    return <div>Loading...</div>
  }

  const rateLimitLow = rateLimit && rateLimit.remaining < 100

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar src={user.image} name={user.email} size={48} />
          <h1 className={styles.title}>{user.email}'s Pull Requests</h1>
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

          <Button variant="danger" leadingIcon={<SignOutIcon size={16} />} onClick={handleSignOut}>
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
})
