import { useState, useCallback } from "react"
import { Link, useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { Breadcrumb } from "@/components/Breadcrumb"
import { queries } from "@/db/queries"
import styles from "./RepoPage.module.css"

// Language colors
const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
}

function PullRequestsTab({
  repoId,
  fullName,
}: {
  repoId: string
  fullName: string
}) {
  const [prs] = useQuery(queries.pullRequests(repoId))
  const openPRs = prs.filter((pr) => pr.state === "open")

  return (
    <Link href={`/${fullName}/pulls`} className={styles.tab}>
      <svg
        className={styles.tabIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
        <line x1="6" y1="9" x2="6" y2="21" />
      </svg>
      Pull requests
      {openPRs.length > 0 && (
        <span className={styles.tabCount}>{openPRs.length}</span>
      )}
    </Link>
  )
}

export function RepoPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repos] = useQuery(queries.repo(fullName))
  const repo = repos[0]

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch(`/api/github/sync/${owner}/${repoName}`, {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }, [owner, repoName])

  if (!repo) {
    return (
      <div className={styles.container}>
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
          <h3 className={styles.emptyTitle}>Repository not found</h3>
          <p className={styles.emptyText}>
            This repository hasn't been synced yet.{" "}
            <Link href="/">Go back to overview</Link> and sync your
            repositories.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Repositories", href: "/" },
          { label: owner, href: `/${owner}` },
          { label: repoName, href: `/${owner}/${repoName}` },
        ]}
      />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <svg
              className={styles.repoIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {repo.name}
            {repo.private && (
              <svg
                className={styles.privateIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </h1>
          {repo.description && (
            <p className={styles.description}>{repo.description}</p>
          )}
          <div className={styles.meta}>
            {repo.language && (
              <span className={styles.metaItem}>
                <span
                  className={styles.languageDot}
                  style={{
                    backgroundColor: languageColors[repo.language] || "#8b949e",
                  }}
                />
                {repo.language}
              </span>
            )}
            <span className={styles.metaItem}>
              <svg
                className={styles.metaIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {repo.stargazersCount} stars
            </span>
            <span className={styles.metaItem}>
              <svg
                className={styles.metaIcon}
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
              {repo.forksCount} forks
            </span>
            <span className={styles.metaItem}>
              <svg
                className={styles.metaIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {repo.openIssuesCount} open issues
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
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
            {syncing ? "Syncing PRs..." : "Sync Pull Requests"}
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

      {/* Tabs */}
      <nav className={styles.tabs}>
        <Link
          href={`/${fullName}`}
          className={`${styles.tab} ${styles.tabActive}`}
        >
          <svg
            className={styles.tabIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Code
        </Link>
        <PullRequestsTab repoId={repo.id} fullName={fullName} />
      </nav>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className={styles.emptyTitle}>Repository Overview</h3>
          <p className={styles.emptyText}>
            View{" "}
            <Link href={`/${fullName}/pulls`} style={{ color: "#58a6ff" }}>
              Pull Requests
            </Link>{" "}
            to see code changes.
          </p>
        </div>
      </div>
    </div>
  )
}
