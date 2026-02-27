import { Link } from "@tanstack/react-router"
import { RepoIcon, LockIcon, StarIcon, RepoForkedIcon } from "@primer/octicons-react"
import { formatTimeAgo } from "@/lib/dashboard-utils"
import styles from "./RepoList.module.css"

interface RepoEntry {
  id: string
  name: string
  fullName: string
  owner: string
  language?: string | null
  private?: boolean | null
  stargazersCount?: number | null
  forksCount?: number | null
  githubPushedAt?: number | null
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  Ruby: "#701516",
  "C++": "#f34b7d",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Shell: "#89e051",
}

const RepoRow = ({ repo }: { repo: RepoEntry }) => (
  <Link to="/$owner/$repo" params={{ owner: repo.owner, repo: repo.name }} className={styles.row}>
    <div className={styles.icon}>
      {repo.private ? (
        <LockIcon size={14} className={styles.lockIcon} />
      ) : (
        <RepoIcon size={14} className={styles.repoIcon} />
      )}
    </div>
    <div className={styles.body}>
      <span className={styles.name}>{repo.fullName}</span>
      <div className={styles.meta}>
        {repo.language && (
          <span className={styles.lang}>
            <span
              className={styles.langDot}
              style={{ backgroundColor: LANG_COLORS[repo.language] ?? "#7c8aff" }}
            />
            {repo.language}
          </span>
        )}
        {(repo.stargazersCount ?? 0) > 0 && (
          <span className={styles.stat}>
            <StarIcon size={10} />
            {repo.stargazersCount}
          </span>
        )}
        {(repo.forksCount ?? 0) > 0 && (
          <span className={styles.stat}>
            <RepoForkedIcon size={10} />
            {repo.forksCount}
          </span>
        )}
      </div>
    </div>
    {repo.githubPushedAt && (
      <span className={styles.time}>{formatTimeAgo(repo.githubPushedAt)}</span>
    )}
  </Link>
)

interface RepoListProps {
  repos: RepoEntry[]
  maxItems?: number
}

export const RepoList = ({ repos, maxItems = 10 }: RepoListProps) => {
  const sorted = [...repos].sort((a, b) => (b.githubPushedAt ?? 0) - (a.githubPushedAt ?? 0))
  const display = sorted.slice(0, maxItems)

  if (display.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No repositories synced yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {display.map((repo) => (
        <RepoRow key={repo.id} repo={repo} />
      ))}
    </div>
  )
}
