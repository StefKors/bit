import type { Row } from "@rocicorp/zero"
import styles from "./RepoHeader.module.css"

type Repo = Row["githubRepo"]

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

interface RepoHeaderProps {
  repo: Repo
  syncing: boolean
  onSync: () => void
}

export function RepoHeader({ repo, syncing, onSync }: RepoHeaderProps) {
  return (
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
          onClick={onSync}
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
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>
    </header>
  )
}
