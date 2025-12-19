import { useMemo } from "react"
import { Link } from "wouter"
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

export function RepoSection({
  repos,
  orgs,
  currentUserLogin,
}: RepoSectionProps) {
  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const groups = new Map<string, OwnerGroup>()

    // Create a map of org logins to their avatar URLs
    const orgMap = new Map(orgs.map((org) => [org.login, org.avatarUrl]))

    for (const repo of repos) {
      const owner = repo.owner
      if (!groups.has(owner)) {
        const isOrg = orgMap.has(owner)
        const isCurrentUser =
          currentUserLogin?.toLowerCase() === owner.toLowerCase()

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
    )
  }

  return (
    <div className={styles.container}>
      {groupedRepos.map((group) => (
        <section key={group.owner} className={styles.section}>
          <Link href={`/${group.owner}`} className={styles.sectionHeader}>
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
                {group.isOrg ? (
                  <svg
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
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
            )}
            <h2 className={styles.sectionTitle}>
              {group.owner}
              {group.isCurrentUser && <span className={styles.badge}>you</span>}
              {group.isOrg && !group.isCurrentUser && (
                <span className={styles.orgBadge}>org</span>
              )}
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
