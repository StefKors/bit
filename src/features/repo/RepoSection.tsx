import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { FileDirectoryIcon, OrganizationIcon, PersonIcon } from "@primer/octicons-react"
import type { Repo, Organization } from "./types"
import { RepoCard } from "./RepoCard"
import styles from "./RepoSection.module.css"

interface RepoSectionProps {
  repos: readonly Repo[]
  orgs: readonly Organization[]
  currentUserLogin?: string
}

interface OwnerGroup {
  owner: string
  avatarUrl?: string | null
  isOrg: boolean
  isCurrentUser: boolean
  repos: Repo[]
}

export function RepoSection({ repos, orgs, currentUserLogin }: RepoSectionProps) {
  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const groups = new Map<string, OwnerGroup>()

    // Create a map of org logins to their avatar URLs
    const orgMap = new Map(orgs.map((org) => [org.login, org.avatarUrl]))

    for (const repo of repos) {
      const owner = repo.owner
      if (!groups.has(owner)) {
        const isOrg = orgMap.has(owner)
        const isCurrentUser = currentUserLogin?.toLowerCase() === owner.toLowerCase()

        groups.set(owner, {
          owner,
          avatarUrl: isOrg ? orgMap.get(owner) : null,
          isOrg,
          isCurrentUser,
          repos: [],
        })
      }
      groups.get(owner)!.repos.push(repo)
    }

    // Sort groups: current user first, then orgs, then others alphabetically
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1
      if (!a.isCurrentUser && b.isCurrentUser) return 1
      if (a.isOrg && !b.isOrg) return -1
      if (!a.isOrg && b.isOrg) return 1
      return a.owner.localeCompare(b.owner)
    })
  }, [repos, orgs, currentUserLogin])

  if (repos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileDirectoryIcon className={styles.emptyIcon} size={48} />
        <h3 className={styles.emptyTitle}>No repositories synced</h3>
        <p className={styles.emptyText}>
          Click "Sync GitHub" to fetch your repositories from GitHub.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {groupedRepos.map((group) => (
        <section key={group.owner} className={styles.section}>
          <Link to="/$owner" params={{ owner: group.owner }} className={styles.sectionHeader}>
            {group.avatarUrl ? (
              <img
                src={group.avatarUrl}
                alt={group.owner}
                className={`${styles.ownerAvatar} ${group.isOrg ? styles.ownerAvatarOrg : styles.ownerAvatarUser}`}
              />
            ) : (
              <div
                className={`${styles.ownerAvatarPlaceholder} ${group.isOrg ? styles.ownerAvatarPlaceholderOrg : styles.ownerAvatarPlaceholderUser}`}
              >
                {group.isOrg ? <OrganizationIcon size={16} /> : <PersonIcon size={16} />}
              </div>
            )}
            <h2 className={styles.sectionTitle}>
              {group.owner}
              {group.isCurrentUser && <span className={styles.badge}>you</span>}
              {group.isOrg && !group.isCurrentUser && <span className={styles.orgBadge}>org</span>}
            </h2>
            <span className={styles.repoCount}>{group.repos.length}</span>
          </Link>

          <div className={styles.grid}>
            {group.repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
