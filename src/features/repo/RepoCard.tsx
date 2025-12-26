import { Link } from "@tanstack/react-router"
import { LockIcon, StarIcon, RepoForkedIcon } from "@primer/octicons-react"
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
    <Link to={`/${repo.fullName}`} className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardContent}>
          <h3 className={styles.cardTitle}>
            {repo.name}
            {repo.private && <LockIcon className={styles.privateIcon} size={12} />}
          </h3>
          <p className={styles.cardDescription}>{repo.description || "No description"}</p>
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
          <StarIcon className={styles.cardStatIcon} size={16} />
          {repo.stargazersCount}
        </span>
        <span className={styles.cardStat}>
          <RepoForkedIcon className={styles.cardStatIcon} size={16} />
          {repo.forksCount}
        </span>
      </div>
    </Link>
  )
}
