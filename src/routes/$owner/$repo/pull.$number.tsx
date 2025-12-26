import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@rocicorp/zero/react"
import {
  GitPullRequestIcon,
  GitMergeIcon,
  SyncIcon,
  CommentIcon,
  FileIcon,
} from "@primer/octicons-react"
import { Breadcrumb } from "@/components/Breadcrumb"
import { Tabs } from "@/components/Tabs"
import { Button } from "@/components/Button"
import { PRConversationTab } from "@/features/pr/PRConversationTab"
import { PRFilesTab } from "@/features/pr/PRFilesTab"
import { DiffOptionsBar, type DiffOptions } from "@/features/pr/DiffOptionsBar"
import { queries } from "@/db/queries"
import styles from "@/pages/PRDetailPage.module.css"

type TabType = "conversation" | "files"

const defaultDiffOptions: DiffOptions = {
  diffStyle: "split",
  diffIndicators: "bars",
  lineDiffType: "word",
  disableLineNumbers: false,
  disableBackground: false,
  overflow: "scroll",
}

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

function PRDetailPage() {
  const { owner, repo, number } = Route.useParams()
  const [activeTab, setActiveTab] = useState<TabType>("conversation")
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diffOptions, setDiffOptions] =
    useState<DiffOptions>(defaultDiffOptions)

  const repoName = repo
  const prNumber = parseInt(number, 10)
  const fullName = `${owner}/${repoName}`

  const [repoData] = useQuery(queries.repoWithPRFull({ fullName, prNumber }))

  const pr = repoData?.githubPullRequest

  const handleSync = async () => {
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

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  if (pr === undefined) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Pull request not found</h3>
        </div>
      </div>
    )
  }

  if (!repoData || !pr) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Pull request not found</h3>
          <p className={styles.emptyText}>
            <Link to="/$owner/$repo/pulls" params={{ owner, repo }}>
              Go back to pull requests
            </Link>
          </p>
          <div style={{ marginTop: "1rem" }}>
            <Button
              variant="success"
              leadingIcon={<SyncIcon size={16} />}
              loading={syncing}
              onClick={() => void handleSync()}
            >
              {syncing ? "Syncing..." : "Sync this PR"}
            </Button>
          </div>
          {error && (
            <div
              style={{
                color: "#f85149",
                marginTop: "1rem",
                padding: "1rem",
                background: "rgba(248, 81, 73, 0.1)",
                borderRadius: "8px",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  const isMerged = pr.merged
  const isClosed = pr.state === "closed"
  const isOpen = pr.state === "open"
  const isDraft = pr.draft

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", to: "/" },
          { label: owner, to: "/$owner", params: { owner } },
          {
            label: repoName,
            to: "/$owner/$repo",
            params: { owner, repo: repoName },
          },
          {
            label: "pull requests",
            to: "/$owner/$repo/pulls",
            params: { owner, repo: repoName },
          },
          { label: `#${prNumber}` },
        ]}
      />

      <div className={styles.headerContainer}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            {isMerged ? (
              <GitMergeIcon
                className={`${styles.prIcon} ${styles.prIconMerged}`}
                size={24}
              />
            ) : (
              <GitPullRequestIcon
                className={`${styles.prIcon} ${isClosed ? styles.prIconClosed : styles.prIconOpen}`}
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
                <span
                  className={`${styles.statusBadge} ${styles.statusMerged}`}
                >
                  Merged
                </span>
              ) : isClosed ? (
                <span
                  className={`${styles.statusBadge} ${styles.statusClosed}`}
                >
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
        </header>
        <div className={styles.actions}>
          <Button
            variant="success"
            leadingIcon={<SyncIcon size={16} />}
            loading={syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? "Syncing..." : "Sync Details"}
          </Button>
        </div>
      </div>

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

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        items={[
          {
            value: "conversation",
            label: "Conversation",
            icon: <CommentIcon size={16} />,
          },
          {
            value: "files",
            label: "Files changed",
            icon: <FileIcon size={16} />,
          },
        ]}
        trailing={
          activeTab === "files" ? (
            <DiffOptionsBar options={diffOptions} onChange={setDiffOptions} />
          ) : undefined
        }
      />

      <div className={styles.content}>
        {activeTab === "conversation" && (
          <PRConversationTab
            prBody={pr.body}
            prAuthor={{
              login: pr.authorLogin,
              avatarUrl: pr.authorAvatarUrl,
            }}
            prCreatedAt={pr.githubCreatedAt}
            reviews={pr.githubPrReview}
            comments={pr.githubPrComment}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {activeTab === "files" && (
          <PRFilesTab
            files={pr.githubPrFile}
            comments={pr.githubPrComment}
            diffOptions={diffOptions}
          />
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  component: PRDetailPage,
})
