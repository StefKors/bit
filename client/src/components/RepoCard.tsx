import { Link } from "wouter"
import type { Repo } from "./types"
import styles from "./RepoCard.module.css"

export type { Repo }

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

interface RepoCardProps {
  repo: Repo
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Link href={`/${repo.fullName}`} className={styles.card}>
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
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
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
                backgroundColor: languageColors[repo.language] || "#8b949e",
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
  )
}
