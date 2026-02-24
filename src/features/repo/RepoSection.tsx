import { useState, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { resolveOwnerAvatarUrl } from "@/lib/avatar"
import type { Repo, Organization } from "./types"
import { RepoCard } from "./RepoCard"
import { RepoFiltersBar } from "./RepoFiltersBar"
import {
  type RepoFilters,
  DEFAULT_REPO_FILTERS,
  extractLanguages,
  applyFiltersAndSort,
  checkActiveFilters,
} from "@/lib/repo-filters"
import styles from "./RepoSection.module.css"

interface RepoSectionProps {
  repos: readonly Repo[]
  orgs: readonly Organization[]
  currentUserLogin?: string
  currentUserAvatarUrl?: string | null
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
  currentUserAvatarUrl,
}: RepoSectionProps) {
  const [filters, setFilters] = useState<RepoFilters>(DEFAULT_REPO_FILTERS)

  // Derive languages and filtered repos
  const languages = useMemo(() => extractLanguages(repos), [repos])
  const filteredRepos = useMemo(() => applyFiltersAndSort(repos, filters), [repos, filters])
  const hasActiveFilters = checkActiveFilters(filters)

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const groups = new Map<string, OwnerGroup>()

    // Create a map of org logins to their avatar URLs
    const orgMap = new Map(orgs.map((org) => [org.login, org.avatarUrl]))

    for (const repo of filteredRepos) {
      const owner = repo.owner
      if (!groups.has(owner)) {
        const isOrg = orgMap.has(owner)
        const isCurrentUser = currentUserLogin?.toLowerCase() === owner.toLowerCase()

        // Get avatar URL: org map for orgs, current user's avatar for their repos
        const avatarUrl = isOrg ? orgMap.get(owner) : isCurrentUser ? currentUserAvatarUrl : null

        groups.set(owner, {
          owner,
          avatarUrl,
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
  }, [filteredRepos, orgs, currentUserLogin, currentUserAvatarUrl])

  if (repos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileDirectoryIcon className={styles.emptyIcon} size={48} />
        <h3 className={styles.emptyTitle}>No repositories synced</h3>
        <p className={styles.emptyText}>Add repositories from Settings to get started.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <RepoFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        languages={languages}
        hasActiveFilters={hasActiveFilters}
        totalCount={repos.length}
        filteredCount={filteredRepos.length}
      />

      {groupedRepos.length > 0 ? (
        groupedRepos.map((group) => (
          <section key={group.owner} className={styles.section}>
            <Link to="/$owner" params={{ owner: group.owner }} className={styles.sectionHeader}>
              <img
                src={resolveOwnerAvatarUrl(group.owner, group.avatarUrl)}
                alt={group.owner}
                className={`${styles.ownerAvatar} ${group.isOrg ? styles.ownerAvatarOrg : styles.ownerAvatarUser}`}
              />
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
        ))
      ) : hasActiveFilters ? (
        <div className={styles.emptyState}>
          <FileDirectoryIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No matching repositories</h3>
          <p className={styles.emptyText}>
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : null}
    </div>
  )
}
