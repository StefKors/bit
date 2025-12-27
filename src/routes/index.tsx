import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { ClockIcon, SyncIcon, SignOutIcon, GitPullRequestIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
import { queries } from "@/db/queries"
import { RepoSection } from "@/features/repo/RepoSection"
import type { PullRequestLike } from "@/features/pr/PRListItem"
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
  const [loadingPRs, setLoadingPRs] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [prOverview, setPrOverview] = useState<{
    authored: (PullRequestLike & { id: string; repoFullName: string })[]
    reviewRequested: (PullRequestLike & { id: string; repoFullName: string })[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [repos] = useQuery(queries.overview())

  const orgs = repos
    .map((repo) => repo.githubOrganization)
    .filter((org): org is NonNullable<typeof org> => org !== null && org !== undefined)
    .filter((org, index, self) => self.findIndex((o) => o.id === org.id) === index)

  const currentUserLogin = session?.user?.name

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

      await handleLoadPRs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  const handleLoadPRs = async () => {
    setLoadingPRs(true)
    setError(null)

    try {
      const response = await fetch("/api/github/pulls/overview?limit=50", {
        method: "GET",
        credentials: "include",
      })

      const data = (await response.json()) as
        | {
            authored: Array<{
              id: string
              repoFullName: string
              number: number
              title: string
              state: "open" | "closed"
              draft: boolean
              merged: boolean
              authorLogin: string | null
              authorAvatarUrl: string | null
              comments: number
              reviewComments: number
              githubCreatedAt: string | null
              githubUpdatedAt: string | null
              htmlUrl: string | null
            }>
            reviewRequested: Array<{
              id: string
              repoFullName: string
              number: number
              title: string
              state: "open" | "closed"
              draft: boolean
              merged: boolean
              authorLogin: string | null
              authorAvatarUrl: string | null
              comments: number
              reviewComments: number
              githubCreatedAt: string | null
              githubUpdatedAt: string | null
              htmlUrl: string | null
            }>
            rateLimit?: { remaining: number; limit: number; reset: string }
          }
        | { error?: string }

      if (!response.ok || !("authored" in data)) {
        throw new Error(("error" in data && data.error) || "Failed to load PRs")
      }

      if (data.rateLimit) {
        setRateLimit({
          remaining: data.rateLimit.remaining,
          limit: data.rateLimit.limit,
          reset: new Date(data.rateLimit.reset),
        })
      }

      setPrOverview({
        authored: data.authored.map((pr) => ({
          id: pr.id,
          repoFullName: pr.repoFullName,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          merged: pr.merged,
          authorLogin: pr.authorLogin,
          authorAvatarUrl: pr.authorAvatarUrl,
          comments: pr.comments,
          reviewComments: pr.reviewComments,
          githubCreatedAt: pr.githubCreatedAt ? new Date(pr.githubCreatedAt).getTime() : null,
          githubUpdatedAt: pr.githubUpdatedAt ? new Date(pr.githubUpdatedAt).getTime() : null,
        })),
        reviewRequested: data.reviewRequested.map((pr) => ({
          id: pr.id,
          repoFullName: pr.repoFullName,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          merged: pr.merged,
          authorLogin: pr.authorLogin,
          authorAvatarUrl: pr.authorAvatarUrl,
          comments: pr.comments,
          reviewComments: pr.reviewComments,
          githubCreatedAt: pr.githubCreatedAt ? new Date(pr.githubCreatedAt).getTime() : null,
          githubUpdatedAt: pr.githubUpdatedAt ? new Date(pr.githubUpdatedAt).getTime() : null,
        })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PRs")
    } finally {
      setLoadingPRs(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.reload()
  }

  if (!session) {
    return null
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
            loading={loadingPRs}
            onClick={() => void handleLoadPRs()}
          >
            {loadingPRs ? "Loading..." : "Refresh PRs"}
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
              {!prOverview ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>Click "Refresh PRs" to load your PRs.</p>
                </div>
              ) : prOverview.authored.length === 0 ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>No open PRs authored by you.</p>
                </div>
              ) : (
                prOverview.authored.map((pr) => (
                  <PRListItem
                    key={pr.id}
                    pr={pr}
                    repoFullName={pr.repoFullName}
                    isApproved={pr.merged === true}
                  />
                ))
              )}
            </div>
          </div>

          <div className={styles.prColumn}>
            <h2 className={styles.prColumnTitle}>Review requested</h2>
            <div className={styles.prList}>
              {!prOverview ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>Click "Refresh PRs" to load your PRs.</p>
                </div>
              ) : prOverview.reviewRequested.length === 0 ? (
                <div className={styles.prEmptyState}>
                  <p className={styles.prEmptyText}>No PRs currently requesting your review.</p>
                </div>
              ) : (
                prOverview.reviewRequested.map((pr) => (
                  <PRListItem
                    key={pr.id}
                    pr={pr}
                    repoFullName={pr.repoFullName}
                    isApproved={pr.merged === true}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <RepoSection repos={repos} orgs={orgs} currentUserLogin={currentUserLogin} />
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: OverviewPage,
})
