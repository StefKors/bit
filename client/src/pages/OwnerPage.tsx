import { useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { zql } from "@/db/schema"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoCard } from "@/components/RepoCard"
import styles from "./OwnerPage.module.css"

export function OwnerPage() {
  const params = useParams<{ owner: string }>()
  const owner = params.owner || ""

  // Query repos for this owner
  const [repos] = useQuery(
    zql.githubRepo
      .where("owner", "=", owner)
      .orderBy("githubUpdatedAt", "desc"),
  )

  // Query orgs to check if this owner is an organization
  const [orgs] = useQuery(
    zql.githubOrganization.where("login", "=", owner).limit(1),
  )
  const org = orgs[0]
  const isOrg = !!org

  // Count stats
  const totalStars = repos.reduce(
    (acc, repo) => acc + (repo.stargazersCount ?? 0),
    0,
  )
  const totalForks = repos.reduce(
    (acc, repo) => acc + (repo.forksCount ?? 0),
    0,
  )

  if (repos.length === 0) {
    return (
      <div className={styles.container}>
        <Breadcrumb
          items={[{ label: "Repositories", href: "/" }, { label: owner }]}
        />
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
          <h3 className={styles.emptyTitle}>No repositories found</h3>
          <p className={styles.emptyText}>
            No repositories have been synced for {owner}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[{ label: "Repositories", href: "/" }, { label: owner }]}
      />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {org?.avatarUrl ? (
            <img
              src={org.avatarUrl}
              alt={owner}
              className={`${styles.ownerAvatar} ${isOrg ? styles.ownerAvatarOrg : styles.ownerAvatarUser}`}
            />
          ) : (
            <div
              className={`${styles.ownerAvatarPlaceholder} ${isOrg ? styles.ownerAvatarPlaceholderOrg : styles.ownerAvatarPlaceholderUser}`}
            >
              {isOrg ? (
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
          <div className={styles.ownerInfo}>
            <h1 className={styles.title}>
              {owner}
              {isOrg && <span className={styles.orgBadge}>org</span>}
            </h1>
            <div className={styles.stats}>
              <span className={styles.stat}>
                <svg
                  className={styles.statIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {repos.length} repositories
              </span>
              <span className={styles.stat}>
                <svg
                  className={styles.statIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {totalStars} stars
              </span>
              <span className={styles.stat}>
                <svg
                  className={styles.statIcon}
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
                {totalForks} forks
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Repositories Grid */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <svg
            className={styles.sectionIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Repositories
        </h2>
        <div className={styles.grid}>
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      </section>
    </div>
  )
}
