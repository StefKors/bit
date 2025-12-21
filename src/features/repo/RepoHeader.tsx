import type { Row } from "@rocicorp/zero"
import {
  RepoIcon,
  LockIcon,
  StarIcon,
  RepoForkedIcon,
  IssueOpenedIcon,
  SyncIcon,
} from "@primer/octicons-react"
import { Button } from "@/components/Button"
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
  onSync: () => void | Promise<void>
}

export function RepoHeader({ repo, syncing, onSync }: RepoHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>
          <RepoIcon className={styles.repoIcon} size={20} />
          {repo.name}
          {repo.private && (
            <LockIcon className={styles.privateIcon} size={14} />
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
            <StarIcon className={styles.metaIcon} size={16} />
            {repo.stargazersCount} stars
          </span>
          <span className={styles.metaItem}>
            <RepoForkedIcon className={styles.metaIcon} size={16} />
            {repo.forksCount} forks
          </span>
          <span className={styles.metaItem}>
            <IssueOpenedIcon className={styles.metaIcon} size={16} />
            {repo.openIssuesCount} open issues
          </span>
        </div>
      </div>

      <div className={styles.headerActions}>
        <Button
          variant="success"
          leadingIcon={<SyncIcon size={16} />}
          loading={syncing}
          onClick={() => void onSync()}
        >
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>
    </header>
  )
}
