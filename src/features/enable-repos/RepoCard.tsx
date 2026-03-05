import { LinkExternalIcon, RepoIcon, CheckIcon } from "@primer/octicons-react"
import type { InstallationRepo } from "@/lib/GithubInstallationRepos"
import styles from "./RepoCard.module.css"

interface RepoCardProps {
  repo: InstallationRepo
  selected: boolean
  enabled: boolean
  onToggle: () => void
}

export function RepoCard({ repo, selected, enabled, onToggle }: RepoCardProps) {
  return (
    <button
      type="button"
      className={`${styles.repoCard} ${selected ? styles.selected : ""}`}
      onClick={onToggle}
    >
      <span className={styles.check}>{selected ? <CheckIcon size={16} /> : null}</span>
      <RepoIcon size={20} className={styles.repoIcon} />
      <div className={styles.repoInfo}>
        <span className={styles.repoName}>{repo.fullName}</span>
        {enabled && <span className={styles.enabledBadge}>Enabled</span>}
        {repo.description && <p className={styles.repoDesc}>{repo.description}</p>}
        <div className={styles.repoMeta}>
          {repo.language && <span className={styles.meta}>{repo.language}</span>}
          <span className={styles.meta}>★ {repo.stargazersCount}</span>
          <span className={styles.meta}>Fork {repo.forksCount}</span>
        </div>
      </div>
      <a
        href={repo.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.external}
        onClick={(e) => {
          e.stopPropagation()
        }}
        aria-label={`Open ${repo.fullName} on GitHub`}
      >
        <LinkExternalIcon size={14} />
      </a>
    </button>
  )
}
