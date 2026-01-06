import { createFileRoute, Link } from "@tanstack/react-router"
import {
  FileDirectoryIcon,
  RepoIcon,
  StarIcon,
  RepoForkedIcon,
  OrganizationIcon,
  PersonIcon,
  LinkExternalIcon,
  LockIcon,
} from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { Breadcrumb } from "@/components/Breadcrumb"
import styles from "@/pages/OwnerPage.module.css"

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

const OwnerPage = () => {
  const params: { owner?: string } = Route.useParams()
  const { user } = db.useAuth()

  const owner = params?.owner ?? ""

  // Query repos by owner with organization
  const { data: reposData } = db.useQuery({
    repos: {
      $: { where: { owner } },
      organization: {},
    },
  })
  const repos = reposData?.repos ?? []

  // Get org from first repo's related data (all repos share same org if it exists)
  const org = repos[0]?.organization ?? null
  const isOrg = Boolean(org)
  const isCurrentUser = user?.email?.split("@")[0]?.toLowerCase() === owner.toLowerCase()

  const totalStars = repos.reduce((acc, repo) => acc + (repo.stargazersCount ?? 0), 0)
  const totalForks = repos.reduce((acc, repo) => acc + (repo.forksCount ?? 0), 0)

  // Get avatar and display name
  const avatarUrl = isOrg ? org?.avatarUrl : isCurrentUser ? user?.image : null
  const displayName = isOrg ? org?.name || owner : isCurrentUser ? user?.email : owner
  const description = isOrg ? org?.description : null

  if (repos.length === 0) {
    return (
      <div className={styles.container}>
        <Breadcrumb items={[{ label: "Repositories", to: "/" }, { label: owner }]} />
        <div className={styles.profileLayout}>
          <aside className={styles.sidebar}>
            <div className={styles.avatarSection}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={owner}
                  className={`${styles.avatar} ${isOrg ? styles.avatarOrg : ""}`}
                />
              ) : (
                <div
                  className={`${styles.avatarPlaceholder} ${isOrg ? styles.avatarPlaceholderOrg : ""}`}
                >
                  {isOrg ? <OrganizationIcon /> : <PersonIcon />}
                </div>
              )}
              <div className={styles.profileInfo}>
                {displayName && displayName !== owner && (
                  <h1 className={styles.displayName}>{displayName}</h1>
                )}
                <p className={styles.username}>{owner}</p>
                {description && <p className={styles.bio}>{description}</p>}
                <div className={styles.badges}>
                  {isOrg && <span className={styles.orgBadge}>Organization</span>}
                  {isCurrentUser && <span className={styles.badge}>You</span>}
                </div>
              </div>
            </div>
          </aside>
          <main className={styles.main}>
            <div className={styles.emptyState}>
              <FileDirectoryIcon className={styles.emptyIcon} size={48} />
              <h3 className={styles.emptyTitle}>No repositories found</h3>
              <p className={styles.emptyText}>No repositories have been synced for {owner}.</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Breadcrumb items={[{ label: "Repositories", to: "/" }, { label: owner }]} />

      <div className={styles.profileLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.avatarSection}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={owner}
                className={`${styles.avatar} ${isOrg ? styles.avatarOrg : ""}`}
              />
            ) : (
              <div
                className={`${styles.avatarPlaceholder} ${isOrg ? styles.avatarPlaceholderOrg : ""}`}
              >
                {isOrg ? <OrganizationIcon /> : <PersonIcon />}
              </div>
            )}
            <div className={styles.profileInfo}>
              {displayName && displayName !== owner && (
                <h1 className={styles.displayName}>{displayName}</h1>
              )}
              <p className={styles.username}>{owner}</p>
              {description && <p className={styles.bio}>{description}</p>}
              <div className={styles.badges}>
                {isOrg && <span className={styles.orgBadge}>Organization</span>}
                {isCurrentUser && <span className={styles.badge}>You</span>}
              </div>
            </div>
          </div>

          <div className={styles.stats}>
            <span className={styles.stat}>
              <RepoIcon className={styles.statIcon} size={16} />
              <strong>{repos.length}</strong> repositories
            </span>
            <span className={styles.stat}>
              <StarIcon className={styles.statIcon} size={16} />
              <strong>{totalStars}</strong> stars
            </span>
            <span className={styles.stat}>
              <RepoForkedIcon className={styles.statIcon} size={16} />
              <strong>{totalForks}</strong> forks
            </span>
          </div>

          <a
            href={`https://github.com/${owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            <LinkExternalIcon className={styles.externalLinkIcon} size={16} />
            View on GitHub
          </a>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          {/* Navigation tabs */}
          <nav className={styles.navTabs}>
            <button className={`${styles.navTab} ${styles.navTabActive}`}>
              <RepoIcon className={styles.navTabIcon} size={16} />
              Repositories
              <span className={styles.navTabCount}>{repos.length}</span>
            </button>
          </nav>

          {/* Repository list */}
          <div className={styles.repoList}>
            {repos.map((repo) => (
              <RepoListItem key={repo.id} repo={repo} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

interface RepoListItemProps {
  repo: {
    id: string
    name: string
    owner: string
    description: string | null | undefined
    language: string | null | undefined
    stargazersCount: number | null | undefined
    forksCount: number | null | undefined
    private: boolean | null | undefined
    githubUpdatedAt: number | null | undefined
  }
}

const RepoListItem = ({ repo }: RepoListItemProps) => {
  const updatedAt = repo.githubUpdatedAt ? formatRelativeTime(new Date(repo.githubUpdatedAt)) : null

  return (
    <Link
      to="/$owner/$repo"
      params={{ owner: repo.owner, repo: repo.name }}
      className={styles.repoItem}
    >
      <div className={styles.repoItemHeader}>
        <h3 className={styles.repoItemName}>{repo.name}</h3>
        {repo.private && (
          <span className={styles.repoItemVisibility}>
            <LockIcon size={12} /> Private
          </span>
        )}
      </div>
      {repo.description && <p className={styles.repoItemDescription}>{repo.description}</p>}
      <div className={styles.repoItemMeta}>
        {repo.language && (
          <span className={styles.repoItemStat}>
            <span
              className={styles.languageDot}
              style={{
                backgroundColor: languageColors[repo.language] || "#8b949e",
              }}
            />
            {repo.language}
          </span>
        )}
        {Boolean(repo.stargazersCount) && (
          <span className={styles.repoItemStat}>
            <StarIcon size={16} />
            {repo.stargazersCount}
          </span>
        )}
        {Boolean(repo.forksCount) && (
          <span className={styles.repoItemStat}>
            <RepoForkedIcon size={16} />
            {repo.forksCount}
          </span>
        )}
        {updatedAt && <span className={styles.repoItemStat}>Updated {updatedAt}</span>}
      </div>
    </Link>
  )
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? "just now" : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`
  }

  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return months === 1 ? "1 month ago" : `${months} months ago`
  }

  const years = Math.floor(diffDays / 365)
  return years === 1 ? "1 year ago" : `${years} years ago`
}

export const Route = createFileRoute("/$owner/")({
  component: OwnerPage,
})
