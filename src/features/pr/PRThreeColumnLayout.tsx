import {
  GitPullRequestIcon,
  GitMergeIcon,
  SyncIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
} from "@primer/octicons-react"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"
import { Button } from "@/components/Button"
import { DiffOptionsBar, type DiffOptions } from "./DiffOptionsBar"
import { PRActivityFeed } from "./PRActivityFeed"
import { PRFilesTab } from "./PRFilesTab"
import { PRListItem } from "./PRListItem"
import styles from "./PRThreeColumnLayout.module.css"

type PullRequest = InstaQLEntity<AppSchema, "pullRequests">
type PrFile = InstaQLEntity<AppSchema, "prFiles">
type PrReview = InstaQLEntity<AppSchema, "prReviews">
type PrComment = InstaQLEntity<AppSchema, "prComments">
type PrEvent = InstaQLEntity<AppSchema, "prEvents">

type DetailedPullRequest = PullRequest & {
  prFiles?: readonly PrFile[]
  prReviews?: readonly PrReview[]
  prComments?: readonly PrComment[]
  prEvents?: readonly PrEvent[]
}

type PRThreeColumnLayoutProps = {
  owner: string
  repoName: string
  pr: DetailedPullRequest
  prs: readonly PullRequest[]
  syncing: boolean
  onSync: () => void
  diffOptions: DiffOptions
  onDiffOptionsChange: (options: DiffOptions) => void
  formatTimeAgo: (date: Date | number | null | undefined) => string
}

const PullRequestStateIcon = ({
  isMerged,
  isClosed,
  isDraft,
}: {
  isMerged: boolean
  isClosed: boolean
  isDraft: boolean
}) => {
  if (isMerged) {
    return <GitMergeIcon size={20} className={`${styles.stateIcon} ${styles.stateIconMerged}`} />
  }

  if (isDraft) {
    return (
      <GitPullRequestDraftIcon
        size={20}
        className={`${styles.stateIcon} ${styles.stateIconDraft}`}
      />
    )
  }

  if (isClosed) {
    return (
      <GitPullRequestClosedIcon
        size={20}
        className={`${styles.stateIcon} ${styles.stateIconClosed}`}
      />
    )
  }

  return <GitPullRequestIcon size={20} className={`${styles.stateIcon} ${styles.stateIconOpen}`} />
}

export const PRThreeColumnLayout = ({
  owner,
  repoName,
  pr,
  prs,
  syncing,
  onSync,
  diffOptions,
  onDiffOptionsChange,
  formatTimeAgo,
}: PRThreeColumnLayoutProps) => {
  const isMerged = pr.merged
  const isClosed = pr.state === "closed"
  const isOpen = pr.state === "open"
  const isDraft = pr.draft
  const repoFullName = `${owner}/${repoName}`

  const prFiles = pr.prFiles ?? []
  const prReviews = pr.prReviews ?? []
  const prComments = pr.prComments ?? []
  const prEvents = pr.prEvents ?? []

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <PullRequestStateIcon isMerged={isMerged} isClosed={isClosed} isDraft={isDraft} />
            <h1 className={styles.title}>
              {pr.title}
              <span className={styles.prNumber}> #{pr.number}</span>
              {isDraft ? (
                <span className={`${styles.statusBadge} ${styles.statusDraft}`}>Draft</span>
              ) : isMerged ? (
                <span className={`${styles.statusBadge} ${styles.statusMerged}`}>Merged</span>
              ) : isClosed ? (
                <span className={`${styles.statusBadge} ${styles.statusClosed}`}>Closed</span>
              ) : (
                <span className={`${styles.statusBadge} ${styles.statusOpen}`}>Open</span>
              )}
            </h1>
          </div>
          <div className={styles.meta}>
            {pr.authorLogin && (
              <span className={styles.metaItem}>
                <strong>{pr.authorLogin}</strong>
              </span>
            )}
            <span className={styles.metaItem}>
              to
              <span className={styles.branchInfo}>{pr.baseRef ?? "unknown"}</span>
              from
              <span className={styles.branchInfo}>{pr.headRef ?? "unknown"}</span>
            </span>
            <span className={styles.metaItem}>
              {isOpen
                ? `opened ${formatTimeAgo(pr.githubCreatedAt)}`
                : isMerged
                  ? `merged ${formatTimeAgo(pr.mergedAt)}`
                  : `closed ${formatTimeAgo(pr.closedAt)}`}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            variant="success"
            leadingIcon={<SyncIcon size={16} />}
            loading={syncing}
            onClick={() => onSync()}
          >
            {syncing ? "Syncing..." : "Sync Details"}
          </Button>
        </div>
      </div>

      <div className={styles.columns}>
        <section className={`${styles.column} ${styles.listColumn}`}>
          <header className={styles.columnHeader}>
            <h2 className={styles.columnTitle}>Pull Requests</h2>
            <span className={styles.columnCount}>{prs.length}</span>
          </header>
          <div className={styles.columnBody}>
            {prs.length === 0 ? (
              <div className={styles.emptyState}>No pull requests in this repository.</div>
            ) : (
              <div className={styles.prList}>
                {prs.map((repoPr) => (
                  <PRListItem
                    key={repoPr.id}
                    pr={repoPr}
                    repoFullName={repoFullName}
                    isApproved={repoPr.merged === true}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={`${styles.column} ${styles.diffsColumn}`}>
          <header className={`${styles.columnHeader} ${styles.diffColumnHeader}`}>
            <h2 className={styles.columnTitle}>Diffs</h2>
            <DiffOptionsBar options={diffOptions} onChange={onDiffOptionsChange} />
          </header>
          <div className={styles.columnBody}>
            <PRFilesTab files={prFiles} comments={prComments} diffOptions={diffOptions} />
          </div>
        </section>

        <section className={`${styles.column} ${styles.activityColumn}`}>
          <header className={styles.columnHeader}>
            <h2 className={styles.columnTitle}>Description & Activity</h2>
            <span className={styles.columnCount}>{prComments.length + prReviews.length}</span>
          </header>
          <div className={styles.columnBody}>
            <PRActivityFeed
              prBody={pr.body}
              prAuthor={{
                login: pr.authorLogin,
                avatarUrl: pr.authorAvatarUrl,
              }}
              prCreatedAt={pr.githubCreatedAt}
              events={prEvents}
              reviews={prReviews}
              comments={prComments}
              formatTimeAgo={formatTimeAgo}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
