import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@rocicorp/zero/react"
import {
  FileDirectoryIcon,
  OrganizationIcon,
  PersonIcon,
  RepoIcon,
  StarIcon,
  RepoForkedIcon,
} from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoCard } from "@/features/repo/RepoCard"
import styles from "@/pages/OwnerPage.module.css"

function OwnerPage() {
  const { owner } = Route.useParams()

  const [org] = useQuery(queries.ownerWithRepos(owner))
  const [userRepos] = useQuery(queries.reposByOwner(owner))

  const repos = org?.githubRepo ?? userRepos
  const isOrg = Boolean(org)

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
          <FileDirectoryIcon className={styles.emptyIcon} size={48} />
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
                <OrganizationIcon size={24} />
              ) : (
                <PersonIcon size={24} />
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
                <RepoIcon className={styles.statIcon} size={16} />
                {repos.length} repositories
              </span>
              <span className={styles.stat}>
                <StarIcon className={styles.statIcon} size={16} />
                {totalStars} stars
              </span>
              <span className={styles.stat}>
                <RepoForkedIcon className={styles.statIcon} size={16} />
                {totalForks} forks
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <RepoIcon className={styles.sectionIcon} size={20} />
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

export const Route = createFileRoute("/$owner/")({
  component: OwnerPage,
})

