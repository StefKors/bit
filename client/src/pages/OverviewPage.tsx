import { useState, useCallback } from "react"
import { Link } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { authClient } from "@/lib/auth"
import { zql } from "@/db/schema"
import styles from "./OverviewPage.module.css"
import { queries } from "@/db/queries"

interface OverviewPageProps {
  onLogout: () => void
}

interface RateLimitInfo {
  remaining: number
  limit: number
  reset: Date
}

// Language colors for common languages
const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  PHP: "#4F5D95",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
}

export function OverviewPage({ onLogout }: OverviewPageProps) {
  const { data: session } = authClient.useSession()
  const [syncing, setSyncing] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Query repos and orgs from Zero
  const [repos] = useQuery(queries.repos())
  const [orgs] = useQuery(queries.orgs())
  console.log({ repos, orgs })
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

      {/* Organizations Section */}
      {orgs.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg
              className={styles.sectionIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Organizations
          </h2>
          <div className={styles.grid}>
            {orgs.map((org) => (
              <Link href={`/${org.login}`} key={org.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  {org.avatarUrl ? (
                    <img
                      src={org.avatarUrl}
                      alt={org.login}
                      className={styles.cardIcon}
                      style={{ borderRadius: "6px" }}
                    />
                  ) : (
                    <svg
                      className={styles.cardIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  )}
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>{org.login}</h3>
                    {org.description && (
                      <p className={styles.cardDescription}>
                        {org.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Repositories Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <svg
            className={styles.sectionIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Repositories ({repos.length})
        </h2>

        {repos.length === 0 ? (
          <div className={styles.emptyState}>
            <svg
              className={styles.emptyIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className={styles.emptyTitle}>No repositories synced</h3>
            <p className={styles.emptyText}>
              Click "Sync GitHub" to fetch your repositories from GitHub.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {repos.map((repo) => (
              <Link
                href={`/${repo.fullName}`}
                key={repo.id}
                className={styles.card}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>
                      {repo.name}
                      {repo.private && (
                        <svg
                          className={styles.privateIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{
                            marginLeft: "0.5rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
                    </h3>
                    <p className={styles.cardDescription}>
                      {repo.description || "No description"}
                    </p>
                  </div>
                </div>
                <div className={styles.cardMeta}>
                  {repo.language && (
                    <span className={styles.cardStat}>
                      <span
                        className={styles.languageDot}
                        style={{
                          backgroundColor:
                            languageColors[repo.language] || "#8b949e",
                        }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span className={styles.cardStat}>
                    <svg
                      className={styles.cardStatIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {repo.stargazersCount}
                  </span>
                  <span className={styles.cardStat}>
                    <svg
                      className={styles.cardStatIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="18" cy="6" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                      <path d="M6 9a9 9 0 0 0 9 9" />
                    </svg>
                    {repo.forksCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
