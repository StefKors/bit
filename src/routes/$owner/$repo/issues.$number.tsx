import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { IssueOpenedIcon, IssueClosedIcon, SkipIcon, SyncIcon } from "@primer/octicons-react"
import { Breadcrumb } from "@/components/Breadcrumb"
import { Button } from "@/components/Button"
import { IssueConversationTab } from "@/features/issue/IssueConversationTab"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncIssueMutation } from "@/lib/mutations"
import { parseLabels } from "@/lib/issue-filters"
import styles from "@/pages/IssueDetailPage.module.css"

const formatTimeAgo = (date: Date | number | null | undefined): string => {
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

const IssueDetailPage = () => {
  const { user } = useAuth()
  const { owner, repo, number } = Route.useParams()

  const repoName = repo
  const issueNumber = parseInt(number, 10)
  const fullName = `${owner}/${repoName}`

  const issueSync = useMutation(syncIssueMutation(user?.id ?? "", owner, repoName, issueNumber))
  const syncing = issueSync.isPending
  const error = issueSync.error?.message ?? null

  const { data: reposData } = db.useQuery({
    repos: {
      $: { where: { fullName } },
      issues: {
        $: { where: { number: issueNumber } },
        issueComments: {},
      },
    },
  })

  const repoData = reposData?.repos?.[0] ?? null
  const issue = repoData?.issues?.[0] ?? null

  if (issue === undefined) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <IssueOpenedIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Issue not found</h3>
        </div>
      </div>
    )
  }

  if (!repoData || !issue) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <IssueOpenedIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Issue not found</h3>
          <p className={styles.emptyText}>
            <Link to="/$owner/$repo/issues" params={{ owner, repo }}>
              Go back to issues
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const isClosed = issue.state === "closed"
  const isOpen = issue.state === "open"
  const isNotPlanned = issue.stateReason === "not_planned"
  const labels = issue.labels ? parseLabels(issue.labels) : []
  const issueComments = issue.issueComments ?? []

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", to: "/" },
          { label: owner, to: "/$owner", params: { owner } },
          { label: repoName, to: "/$owner/$repo", params: { owner, repo: repoName } },
          { label: "issues", to: "/$owner/$repo/issues", params: { owner, repo: repoName } },
          { label: `#${issueNumber}` },
        ]}
      />

      <div className={styles.headerContainer}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            {isClosed && isNotPlanned ? (
              <SkipIcon className={`${styles.issueIcon} ${styles.issueIconNotPlanned}`} size={24} />
            ) : isClosed ? (
              <IssueClosedIcon
                className={`${styles.issueIcon} ${styles.issueIconClosed}`}
                size={24}
              />
            ) : (
              <IssueOpenedIcon
                className={`${styles.issueIcon} ${styles.issueIconOpen}`}
                size={24}
              />
            )}
            <h1 className={styles.title}>
              {issue.title}
              <span className={styles.issueNumber}> #{issue.number}</span>
              {isNotPlanned ? (
                <span className={`${styles.statusBadge} ${styles.statusNotPlanned}`}>
                  Not planned
                </span>
              ) : isClosed ? (
                <span className={`${styles.statusBadge} ${styles.statusClosed}`}>Closed</span>
              ) : (
                <span className={`${styles.statusBadge} ${styles.statusOpen}`}>Open</span>
              )}
            </h1>
          </div>

          <div className={styles.meta}>
            {issue.authorLogin && (
              <span className={styles.metaItem}>
                {issue.authorAvatarUrl && (
                  <img
                    src={issue.authorAvatarUrl}
                    alt={issue.authorLogin}
                    className={styles.authorAvatar}
                  />
                )}
                <strong>{issue.authorLogin}</strong>
              </span>
            )}
            <span className={styles.metaItem}>
              {isOpen
                ? `opened ${formatTimeAgo(issue.githubCreatedAt)}`
                : `closed ${formatTimeAgo(issue.closedAt)}`}
            </span>
            {Boolean(issue.comments) && issue.comments! > 0 && (
              <span className={styles.metaItem}>{issue.comments} comments</span>
            )}
          </div>

          {labels.length > 0 && (
            <div className={styles.labels}>
              {labels.map((label) => (
                <span key={label} className={styles.label}>
                  {label}
                </span>
              ))}
            </div>
          )}
        </header>
        <div className={styles.actions}>
          <Button
            variant="success"
            leadingIcon={<SyncIcon size={16} />}
            loading={syncing}
            onClick={() => issueSync.mutate()}
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

      <div className={styles.content}>
        <IssueConversationTab
          issueBody={issue.body}
          issueAuthor={{
            login: issue.authorLogin,
            avatarUrl: issue.authorAvatarUrl,
          }}
          issueCreatedAt={issue.githubCreatedAt}
          comments={issueComments}
          formatTimeAgo={formatTimeAgo}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/issues/$number")({
  component: IssueDetailPage,
})
