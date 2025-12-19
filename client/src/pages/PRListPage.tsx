import { useState, useMemo } from "react"
import { Link, useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { zql } from "@/db/schema"
import { Breadcrumb } from "@/components/Breadcrumb"
import styles from "./PRListPage.module.css"

type FilterState = "open" | "closed" | "all"

function formatTimeAgo(date: Date | number | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "number" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

function parseLabels(
  labelsJson: string | null,
): Array<{ name: string; color: string }> {
  if (!labelsJson) return []
  try {
    return JSON.parse(labelsJson)
  } catch {
    return []
  }
}

function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(0, 2), 16)
  const g = parseInt(hexColor.slice(2, 4), 16)
  const b = parseInt(hexColor.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export function PRListPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const [filter, setFilter] = useState<FilterState>("open")

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repos] = useQuery(
    zql.githubRepo.where("fullName", "=", fullName).limit(1),
  )
  const repo = repos[0]

  // Query PRs for this repo
  const [allPrs] = useQuery(
    repo
      ? zql.githubPullRequest
          .where("repoId", "=", repo.id)
          .orderBy("githubUpdatedAt", "desc")
      : zql.githubPullRequest.where("id", "=", "__none__"),
  )

  // Filter PRs based on state
  const filteredPrs = useMemo(() => {
    if (filter === "all") return allPrs
    return allPrs.filter((pr) => pr.state === filter)
  }, [allPrs, filter])

  const openCount = allPrs.filter((pr) => pr.state === "open").length
  const closedCount = allPrs.filter((pr) => pr.state === "closed").length

  if (!repo) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <line x1="6" y1="9" x2="6" y2="21" />
          </svg>
          <h3 className={styles.emptyTitle}>Repository not found</h3>
          <p className={styles.emptyText}>
            <Link href="/">Go back to overview</Link> and sync your
            repositories.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Repositories", href: "/" },
          { label: owner, href: `/${owner}` },
          { label: repoName, href: `/${owner}/${repoName}` },
          { label: "pull requests", href: `/${owner}/${repoName}/pulls` },
        ]}
      />

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          <svg
            className={styles.titleIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <line x1="6" y1="9" x2="6" y2="21" />
          </svg>
          Pull Requests
        </h1>

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filter === "open" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilter("open")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <line x1="6" y1="9" x2="6" y2="21" />
            </svg>
            Open
            <span className={styles.filterCount}>{openCount}</span>
          </button>
          <button
            className={`${styles.filterButton} ${filter === "closed" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilter("closed")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Closed
            <span className={styles.filterCount}>{closedCount}</span>
          </button>
          <button
            className={`${styles.filterButton} ${filter === "all" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilter("all")}
          >
            All
            <span className={styles.filterCount}>{allPrs.length}</span>
          </button>
        </div>
      </header>

      {/* PR List */}
      {filteredPrs.length === 0 ? (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <line x1="6" y1="9" x2="6" y2="21" />
          </svg>
          <h3 className={styles.emptyTitle}>No pull requests</h3>
          <p className={styles.emptyText}>
            {filter === "open"
              ? "There are no open pull requests."
              : filter === "closed"
                ? "There are no closed pull requests."
                : "No pull requests have been synced yet."}
          </p>
        </div>
      ) : (
        <div className={styles.prList}>
          {filteredPrs.map((pr) => {
            const labels = parseLabels(pr.labels)
            const isMerged = pr.merged
            const isClosed = pr.state === "closed"
            const isOpen = pr.state === "open"

            return (
              <div key={pr.id} className={styles.prItem}>
                {/* Status Icon */}
                <svg
                  className={`${styles.prIcon} ${
                    isMerged
                      ? styles.prIconMerged
                      : isClosed
                        ? styles.prIconClosed
                        : styles.prIconOpen
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isMerged ? (
                    <>
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M6 21V9a9 9 0 0 0 9 9" />
                    </>
                  ) : isClosed ? (
                    <>
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      <line x1="6" y1="9" x2="6" y2="21" />
                    </>
                  ) : (
                    <>
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      <line x1="6" y1="9" x2="6" y2="21" />
                    </>
                  )}
                </svg>

                {/* Content */}
                <div className={styles.prContent}>
                  <h3 className={styles.prTitle}>
                    <Link
                      href={`/${fullName}/pull/${pr.number}`}
                      className={styles.prTitleLink}
                    >
                      {pr.title}
                    </Link>
                    {pr.draft && (
                      <span className={styles.draftBadge}>Draft</span>
                    )}
                  </h3>

                  <div className={styles.prMeta}>
                    <span className={styles.prMetaItem}>#{pr.number}</span>
                    <span className={styles.prMetaItem}>
                      {isOpen
                        ? `opened ${formatTimeAgo(pr.githubCreatedAt)}`
                        : isMerged
                          ? `merged ${formatTimeAgo(pr.mergedAt)}`
                          : `closed ${formatTimeAgo(pr.closedAt)}`}
                    </span>
                    {pr.authorLogin && (
                      <span className={styles.prMetaItem}>
                        {pr.authorAvatarUrl && (
                          <img
                            src={pr.authorAvatarUrl}
                            alt={pr.authorLogin}
                            className={styles.authorAvatar}
                          />
                        )}
                        {pr.authorLogin}
                      </span>
                    )}
                    <span className={styles.prMetaItem}>
                      {pr.headRef} → {pr.baseRef}
                    </span>
                  </div>

                  {labels.length > 0 && (
                    <div className={styles.prLabels}>
                      {labels.map((label) => (
                        <span
                          key={label.name}
                          className={styles.prLabel}
                          style={{
                            backgroundColor: `#${label.color}`,
                            color: getContrastColor(label.color),
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className={styles.prStats}>
                  <div className={styles.prDiff}>
                    <span className={styles.prAdditions}>+{pr.additions}</span>
                    <span className={styles.prDeletions}>-{pr.deletions}</span>
                  </div>
                  {(pr.comments ?? 0) + (pr.reviewComments ?? 0) > 0 && (
                    <div className={styles.prComments}>
                      <svg
                        className={styles.prCommentsIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {(pr.comments ?? 0) + (pr.reviewComments ?? 0)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
