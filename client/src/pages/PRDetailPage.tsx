import { useState, useCallback, useMemo } from "react"
import { Link, useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import {
  GitPullRequestIcon,
  GitMergeIcon,
  SyncIcon,
  CommentIcon,
  FileIcon,
  PlusIcon,
  DashIcon,
} from "@primer/octicons-react"
import { zql } from "@/db/schema"
import { DiffViewer } from "@/components/DiffViewer"
import { Breadcrumb } from "@/components/Breadcrumb"
import styles from "./PRDetailPage.module.css"

type TabType = "conversation" | "files"

function formatTimeAgo(date: Date | number | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "number" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 30) return `${diffDays} days ago`
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

export function PRDetailPage() {
  const params = useParams<{ owner: string; repo: string; number: string }>()
  const [activeTab, setActiveTab] = useState<TabType>("conversation")
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const prNumber = parseInt(params.number || "0", 10)
  const fullName = `${owner}/${repoName}`

  // Query the repo
  const [repos] = useQuery(
    zql.githubRepo.where("fullName", "=", fullName).limit(1),
  )
  const repo = repos[0]

  // Query the PR
  const [prs] = useQuery(
    repo
      ? zql.githubPullRequest
          .where("repoId", "=", repo.id)
          .where("number", "=", prNumber)
          .limit(1)
      : zql.githubPullRequest.where("id", "=", "__none__"),
  )
  const pr = prs[0]

  // Query files
  const [files] = useQuery(
    pr
      ? zql.githubPrFile
          .where("pullRequestId", "=", pr.id)
          .orderBy("filename", "asc")
      : zql.githubPrFile.where("id", "=", "__none__"),
  )

  // Query reviews
  const [reviews] = useQuery(
    pr
      ? zql.githubPrReview
          .where("pullRequestId", "=", pr.id)
          .orderBy("submittedAt", "asc")
      : zql.githubPrReview.where("id", "=", "__none__"),
  )

  // Query comments
  const [comments] = useQuery(
    pr
      ? zql.githubPrComment
          .where("pullRequestId", "=", pr.id)
          .orderBy("githubCreatedAt", "asc")
      : zql.githubPrComment.where("id", "=", "__none__"),
  )

  // Combine and sort timeline items
  const timelineItems = useMemo(() => {
    const items: Array<{
      type: "comment" | "review"
      id: string
      authorLogin: string | null
      authorAvatarUrl: string | null
      body: string | null
      createdAt: Date | null
      reviewState?: string
    }> = []

    // Add comments (only issue_comment type for conversation)
    comments
      .filter((c) => c.commentType === "issue_comment")
      .forEach((c) => {
        items.push({
          type: "comment",
          id: c.id,
          authorLogin: c.authorLogin,
          authorAvatarUrl: c.authorAvatarUrl,
          body: c.body,
          createdAt: c.githubCreatedAt ? new Date(c.githubCreatedAt) : null,
        })
      })

    // Add reviews
    reviews.forEach((r) => {
      items.push({
        type: "review",
        id: r.id,
        authorLogin: r.authorLogin,
        authorAvatarUrl: r.authorAvatarUrl,
        body: r.body,
        createdAt: r.submittedAt ? new Date(r.submittedAt) : null,
        reviewState: r.state,
      })
    })

    // Sort by date
    return items.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0
      const bTime = b.createdAt?.getTime() || 0
      return aTime - bTime
    })
  }, [comments, reviews])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/github/sync/${owner}/${repoName}/pull/${prNumber}`,
        {
          method: "POST",
          credentials: "include",
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }, [owner, repoName, prNumber])

  if (!repo || !pr) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Pull request not found</h3>
          <p className={styles.emptyText}>
            <Link href={`/${fullName}/pulls`}>Go back to pull requests</Link>
          </p>
        </div>
      </div>
    )
  }

  const labels = parseLabels(pr.labels)
  const isMerged = pr.merged
  const isClosed = pr.state === "closed"
  const isOpen = pr.state === "open"
  const isDraft = pr.draft

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Repositories", href: "/" },
          { label: owner, href: `/${fullName}` },
          { label: repoName, href: `/${fullName}` },
          { label: "pull requests", href: `/${fullName}/pulls` },
          { label: `#${prNumber}`, href: `/${fullName}/pull/${prNumber}` },
        ]}
      />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          {isMerged ? (
            <GitMergeIcon
              className={`${styles.prIcon} ${styles.prIconMerged}`}
              size={24}
            />
          ) : (
            <GitPullRequestIcon
              className={`${styles.prIcon} ${
                isClosed ? styles.prIconClosed : styles.prIconOpen
              }`}
              size={24}
            />
          )}
          <h1 className={styles.title}>
            {pr.title}
            <span className={styles.prNumber}> #{pr.number}</span>
            {isDraft ? (
              <span className={`${styles.statusBadge} ${styles.statusDraft}`}>
                Draft
              </span>
            ) : isMerged ? (
              <span className={`${styles.statusBadge} ${styles.statusMerged}`}>
                Merged
              </span>
            ) : isClosed ? (
              <span className={`${styles.statusBadge} ${styles.statusClosed}`}>
                Closed
              </span>
            ) : (
              <span className={`${styles.statusBadge} ${styles.statusOpen}`}>
                Open
              </span>
            )}
          </h1>
        </div>

        <div className={styles.meta}>
          {pr.authorLogin && (
            <span className={styles.metaItem}>
              {pr.authorAvatarUrl && (
                <img
                  src={pr.authorAvatarUrl}
                  alt={pr.authorLogin}
                  className={styles.authorAvatar}
                />
              )}
              <strong>{pr.authorLogin}</strong>
            </span>
          )}
          <span className={styles.metaItem}>
            wants to merge into
            <span className={styles.branchInfo}>{pr.baseRef}</span>
            from
            <span className={styles.branchInfo}>{pr.headRef}</span>
          </span>
          <span className={styles.metaItem}>
            {isOpen
              ? `opened ${formatTimeAgo(pr.githubCreatedAt)}`
              : isMerged
                ? `merged ${formatTimeAgo(pr.mergedAt)}`
                : `closed ${formatTimeAgo(pr.closedAt)}`}
          </span>
        </div>

        {labels.length > 0 && (
          <div className={styles.labels}>
            {labels.map((label) => (
              <span
                key={label.name}
                className={styles.label}
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

        <div className={styles.actions}>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`${styles.syncButton} ${syncing ? styles.syncing : ""}`}
          >
            <SyncIcon
              className={`${styles.buttonIcon} ${syncing ? styles.spinning : ""}`}
              size={16}
            />
            {syncing ? "Syncing..." : "Sync Details"}
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            color: "#f85149",
            marginBottom: "1rem",
            padding: "1rem",
            background: "rgba(248, 81, 73, 0.1)",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "conversation" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("conversation")}
        >
          <CommentIcon className={styles.tabIcon} size={16} />
          Conversation
          {timelineItems.length > 0 && (
            <span className={styles.tabCount}>{timelineItems.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "files" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("files")}
        >
          <FileIcon className={styles.tabIcon} size={16} />
          Files changed
          <span className={styles.tabCount}>{files.length}</span>
        </button>
      </nav>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === "conversation" && (
          <div className={styles.timeline}>
            {/* PR Body as first item */}
            {pr.body && (
              <div className={styles.timelineItem}>
                {pr.authorAvatarUrl ? (
                  <img
                    src={pr.authorAvatarUrl}
                    alt={pr.authorLogin || "Author"}
                    className={styles.timelineAvatar}
                  />
                ) : (
                  <div
                    className={styles.timelineAvatar}
                    style={{ background: "#30363d" }}
                  />
                )}
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineAuthor}>
                      {pr.authorLogin}
                    </span>
                    <span className={styles.timelineTime}>
                      opened this pull request{" "}
                      {formatTimeAgo(pr.githubCreatedAt)}
                    </span>
                  </div>
                  <div className={styles.timelineBody}>{pr.body}</div>
                </div>
              </div>
            )}

            {/* Timeline items */}
            {timelineItems.map((item) => (
              <div key={item.id} className={styles.timelineItem}>
                {item.authorAvatarUrl ? (
                  <img
                    src={item.authorAvatarUrl}
                    alt={item.authorLogin || "Author"}
                    className={styles.timelineAvatar}
                  />
                ) : (
                  <div
                    className={styles.timelineAvatar}
                    style={{ background: "#30363d" }}
                  />
                )}
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineAuthor}>
                      {item.authorLogin}
                    </span>
                    {item.type === "review" && item.reviewState && (
                      <span
                        className={`${styles.reviewState} ${
                          item.reviewState === "APPROVED"
                            ? styles.reviewApproved
                            : item.reviewState === "CHANGES_REQUESTED"
                              ? styles.reviewChangesRequested
                              : styles.reviewCommented
                        }`}
                      >
                        {item.reviewState === "APPROVED" && "✓ Approved"}
                        {item.reviewState === "CHANGES_REQUESTED" &&
                          "✗ Changes requested"}
                        {item.reviewState === "COMMENTED" && "Reviewed"}
                      </span>
                    )}
                    <span className={styles.timelineTime}>
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>
                  {item.body && (
                    <div className={styles.timelineBody}>{item.body}</div>
                  )}
                </div>
              </div>
            ))}

            {!pr.body && timelineItems.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>
                  No comments yet. Click "Sync Details" to fetch the latest.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "files" && (
          <>
            <div className={styles.filesHeader}>
              <div className={styles.filesStats}>
                <span className={`${styles.filesStat} ${styles.additionsStat}`}>
                  <PlusIcon className={styles.filesStatIcon} size={16} />
                  {pr.additions} additions
                </span>
                <span className={`${styles.filesStat} ${styles.deletionsStat}`}>
                  <DashIcon className={styles.filesStatIcon} size={16} />
                  {pr.deletions} deletions
                </span>
                <span className={styles.filesStat}>
                  {pr.changedFiles} files changed
                </span>
              </div>
            </div>

            {files.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>
                  No files synced yet. Click "Sync Details" to fetch file
                  changes.
                </p>
              </div>
            ) : (
              <div className={styles.filesList}>
                {files.map((file) => (
                  <div key={file.id}>
                    <div
                      className={styles.fileItem}
                      onClick={() =>
                        setExpandedFile(
                          expandedFile === file.id ? null : file.id,
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <span
                        className={`${styles.fileStatus} ${
                          file.status === "added"
                            ? styles.fileStatusAdded
                            : file.status === "removed"
                              ? styles.fileStatusRemoved
                              : file.status === "renamed"
                                ? styles.fileStatusRenamed
                                : styles.fileStatusModified
                        }`}
                      >
                        {file.status === "added"
                          ? "A"
                          : file.status === "removed"
                            ? "D"
                            : file.status === "renamed"
                              ? "R"
                              : "M"}
                      </span>
                      <span className={styles.fileName}>
                        {file.previousFilename
                          ? `${file.previousFilename} → ${file.filename}`
                          : file.filename}
                      </span>
                      <div className={styles.fileDiff}>
                        <span className={styles.fileAdditions}>
                          +{file.additions}
                        </span>
                        <span className={styles.fileDeletions}>
                          -{file.deletions}
                        </span>
                      </div>
                    </div>
                    {expandedFile === file.id && file.patch && (
                      <DiffViewer
                        filename={file.filename}
                        patch={file.patch}
                        additions={file.additions ?? 0}
                        deletions={file.deletions ?? 0}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
