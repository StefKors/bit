import { useState, useCallback } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { authClient } from "@/lib/auth"
import styles from "./OverviewPage.module.css"
import { queries } from "@/db/queries"
import { RepoSection } from "@/components/RepoSection"

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

      const data = await response.json()

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
              <svg
                className={styles.buttonIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {rateLimit.remaining}/{rateLimit.limit} requests
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className={`${styles.syncButton} ${syncing ? styles.syncing : ""}`}
          >
            <svg
              className={`${styles.buttonIcon} ${syncing ? styles.spinning : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {syncing ? "Syncing..." : "Sync GitHub"}
          </button>

          <button onClick={handleSignOut} className={styles.signOutButton}>
            <svg
              className={styles.buttonIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
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
