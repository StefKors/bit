import { createFileRoute } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { ClockIcon, SyncIcon, SignOutIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
import { queries } from "@/db/queries"
import { RepoSection } from "@/features/repo/RepoSection"
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
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [repos] = useQuery(queries.overview())

  const orgs = repos
    .map((repo) => repo.githubOrganization)
    .filter(
      (org): org is NonNullable<typeof org> =>
        org !== null && org !== undefined,
    )
    .filter(
      (org, index, self) => self.findIndex((o) => o.id === org.id) === index,
    )

  const currentUserLogin = session?.user?.name

  const handleSync = useCallback(async () => {
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
  }, [])

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
          <h1 className={styles.title}>{session.user.name}'s Repositories</h1>
        </div>

        <div className={styles.headerActions}>
          {rateLimit && (
            <div
              className={`${styles.rateLimit} ${rateLimitLow ? styles.rateLimitLow : ""}`}
            >
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

      <RepoSection
        repos={repos}
        orgs={orgs}
        currentUserLogin={currentUserLogin}
      />
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: OverviewPage,
})
