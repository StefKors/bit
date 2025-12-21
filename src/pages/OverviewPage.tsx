import { useState, useCallback } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { ClockIcon, SyncIcon, SignOutIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
import { queries } from "@/db/queries"
import { RepoSection } from "@/features/repo/RepoSection"
import styles from "./OverviewPage.module.css"

interface OverviewPageProps {
  onLogout: () => void
}

interface RateLimitInfo {
  remaining: number
  limit: number
  reset: Date
}

export function OverviewPage({ onLogout }: OverviewPageProps) {
  const { data: session } = authClient.useSession()
  const [syncing, setSyncing] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Query repos and orgs from Zero
  const [repos] = useQuery(queries.repos())
  const [orgs] = useQuery(queries.orgs())

  // Get GitHub username from session (name is typically the GitHub login)
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
    onLogout()
  }

  if (!session) {
    return null
  }

  const rateLimitLow = rateLimit && rateLimit.remaining < 100

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatarContainer}>
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {session.user.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
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

      {/* Repositories grouped by owner */}
      <RepoSection
        repos={repos}
        orgs={orgs}
        currentUserLogin={currentUserLogin}
      />
    </div>
  )
}
