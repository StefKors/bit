import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState, useSyncExternalStore } from "react"
import { useMutation } from "@tanstack/react-query"
import { GitPullRequestIcon, HistoryIcon, FileIcon, GitCommitIcon } from "@primer/octicons-react"
import { Breadcrumb } from "@/components/Breadcrumb"
import { Tabs } from "@/components/Tabs"
import { PRActivityFeed } from "@/features/pr/PRActivityFeed"
import { PRActionsBar } from "@/features/pr/PRActionsBar"
import { PRFilesTab } from "@/features/pr/PRFilesTab"
import { PRCommitsTab } from "@/features/pr/PRCommitsTab"
import { PRThreeColumnLayout } from "@/features/pr/PRThreeColumnLayout"
import { PRHeader } from "@/features/pr/PRHeader"
import { LabelPicker } from "@/features/pr/LabelPicker"
import { ReviewerPicker } from "@/features/pr/ReviewerPicker"
import { DiffOptionsBar, type DiffOptions } from "@/features/pr/DiffOptionsBar"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncPrMutation } from "@/lib/mutations"
import { getPRLayoutMode, subscribePRLayoutMode } from "@/lib/pr-layout-preference"
import {
  type PRFilters,
  type PRFiltersSearchParams,
  parseFiltersFromSearch,
  filtersToSearchParams,
  extractAuthors,
  extractLabels,
  applyFiltersAndSort,
  hasActiveFilters as checkActivePRFilters,
} from "@/lib/pr-filters"
import styles from "@/pages/PRDetailPage.module.css"

type TabType = "conversation" | "commits" | "files"

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

const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as Array<string | number | boolean | null>
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === "string")
  } catch {
    return []
  }
}

const parseLabelArray = (
  value: string | null | undefined,
): Array<{ name: string; color: string | null }> => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as Array<{
      name?: string | number | boolean | null
      color?: string | number | boolean | null
    }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is { name: string; color?: string | number | boolean | null } =>
          typeof entry === "object" && entry !== null && typeof entry.name === "string",
      )
      .map((entry) => ({
        name: entry.name,
        color: typeof entry.color === "string" ? entry.color : null,
      }))
  } catch {
    return []
  }
}

function PRDetailPage() {
  const { user } = useAuth()
  const { owner, repo, number } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>("conversation")
  const [diffOptions, setDiffOptions] = useState<DiffOptions>(defaultDiffOptions)

  const repoName = repo
  const prNumber = parseInt(number, 10)
  const fullName = `${owner}/${repoName}`
  const prSync = useMutation(syncPrMutation(user?.id ?? "", owner, repoName, prNumber, true))
  const syncing = prSync.isPending
  const error = prSync.error?.message ?? null

  const prLayoutMode = useSyncExternalStore(subscribePRLayoutMode, getPRLayoutMode, () => "default")
  const isFullScreenLayout = prLayoutMode === "full-screen-3-column"
  const containerClassName = isFullScreenLayout
    ? `${styles.container} ${styles.containerFullScreen}`
    : styles.container

  const { data: repoListData, isLoading: isRepoLoading } = db.useQuery({
    repos: {
      $: { where: { fullName } },
      pullRequests: {
        $: { order: { githubUpdatedAt: "desc" } },
        prChecks: {},
      },
    },
  })
  const repoData = repoListData?.repos?.[0] ?? null
  const repoPRs = repoData?.pullRequests ?? []
  const filters = parseFiltersFromSearch(search)
  const authors = extractAuthors(repoPRs)
  const labels = extractLabels(repoPRs)
  const filteredRepoPRs = applyFiltersAndSort(repoPRs, filters)
  const hasActiveFilters = checkActivePRFilters(filters)

  const { data: prDetailsRepoData, isLoading: isPrDetailsLoading } = db.useQuery({
    repos: {
      $: { where: { fullName } },
      pullRequests: {
        $: { where: { number: prNumber } },
        prFiles: {},
        prReviews: {},
        prComments: {},
        prCommits: {},
        prEvents: {},
        prChecks: {},
      },
    },
  })
  const freshPr = prDetailsRepoData?.repos?.[0]?.pullRequests?.[0] ?? null

  const previousPrRef = useRef(freshPr)
  if (freshPr) {
    previousPrRef.current = freshPr
  }
  const pr = freshPr ?? previousPrRef.current

  const autoSyncTriggered = useRef(false)
  const dataLoaded = !isRepoLoading && !isPrDetailsLoading

  const needsInitialSync =
    dataLoaded &&
    Boolean(pr) &&
    (pr?.prFiles?.length ?? 0) === 0 &&
    (pr?.prReviews?.length ?? 0) === 0 &&
    (pr?.prComments?.length ?? 0) === 0 &&
    (pr?.prCommits?.length ?? 0) === 0 &&
    (pr?.prEvents?.length ?? 0) === 0

  if (needsInitialSync && !syncing && !autoSyncTriggered.current && user?.id) {
    autoSyncTriggered.current = true
    prSync.mutate()
  }

  const handlePRFiltersChange = (newFilters: PRFilters) => {
    void navigate({
      to: "/$owner/$repo/pull/$number",
      params: { owner, repo: repoName, number },
      search: filtersToSearchParams(newFilters),
      replace: true,
    })
  }

  if (isRepoLoading && !repoData) {
    return <div className={containerClassName} />
  }

  if (!pr && isPrDetailsLoading) {
    return <div className={containerClassName} />
  }

  if (!pr) {
    return (
      <div className={containerClassName}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Pull request not found</h3>
          <p className={styles.emptyText}>
            <Link to="/$owner/$repo/pulls" params={{ owner, repo }}>
              Go back to pull requests
            </Link>
          </p>
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
  const isOpen = pr.state === "open"
  const isDraft = pr.draft
  const prTitle = typeof pr.title === "string" ? pr.title : ""
  const prBody = typeof pr.body === "string" ? pr.body : null
  const prState = pr.state === "closed" ? "closed" : "open"
  const prDraft = Boolean(pr.draft)
  const prMerged = Boolean(pr.merged)

  const prFiles = pr.prFiles ?? []
  const prReviews = pr.prReviews ?? []
  const prComments = pr.prComments ?? []
  const prCommits = pr.prCommits ?? []
  const prEvents = pr.prEvents ?? []
  const prChecks = pr.prChecks ?? []
  const prReviewers = parseStringArray(pr.reviewers ?? pr.reviewRequestedBy)
  const prLabels = parseLabelArray(pr.labels)

  return (
    <div className={containerClassName}>
      {isFullScreenLayout ? (
        <div className={styles.fullScreenTopNavRow}>
          <div className={styles.fullScreenTopNav}>
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
          </div>
        </div>
      ) : (
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
      )}

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

      {isFullScreenLayout ? (
        <PRThreeColumnLayout
          owner={owner}
          repoName={repoName}
          pr={pr}
          prs={filteredRepoPRs}
          totalPrCount={repoPRs.length}
          filters={filters}
          onFiltersChange={handlePRFiltersChange}
          authors={authors}
          labels={labels}
          hasActiveFilters={hasActiveFilters}
          currentUserId={user?.id ?? null}
          currentUserLogin={user?.login ?? null}
          diffOptions={diffOptions}
          onDiffOptionsChange={setDiffOptions}
          formatTimeAgo={formatTimeAgo}
        />
      ) : (
        <>
          <div className={styles.headerContainer}>
            <PRHeader
              userId={user?.id}
              owner={owner}
              repo={repoName}
              prNumber={prNumber}
              title={prTitle}
              body={prBody}
              state={prState}
              draft={prDraft}
              merged={prMerged}
              authorLogin={pr.authorLogin}
              authorAvatarUrl={pr.authorAvatarUrl}
              baseRef={pr.baseRef}
              headRef={pr.headRef}
              githubCreatedAt={pr.githubCreatedAt}
              mergedAt={pr.mergedAt}
              closedAt={pr.closedAt}
              mergeable={
                typeof pr.mergeable === "boolean" || pr.mergeable === null ? pr.mergeable : null
              }
              mergeableState={typeof pr.mergeableState === "string" ? pr.mergeableState : null}
              checks={prChecks}
              onUpdated={() => {
                prSync.mutate()
              }}
              formatTimeAgo={formatTimeAgo}
            />
          </div>

          {user?.id && (
            <PRActionsBar
              userId={user.id}
              owner={owner}
              repo={repoName}
              prNumber={prNumber}
              isOpen={isOpen}
              isDraft={isDraft}
              isMerged={isMerged}
              isLocked={Boolean(pr.locked)}
              lockReason={typeof pr.lockReason === "string" ? pr.lockReason : null}
              mergeable={pr.mergeable}
              mergeableState={pr.mergeableState}
              headRef={pr.headRef ?? ""}
              headSha={pr.headSha ?? ""}
              onMergeSuccess={() => {
                prSync.mutate()
              }}
              onStateChange={() => {
                prSync.mutate()
              }}
            />
          )}

          {user?.id && (
            <div className={styles.managementBar}>
              <ReviewerPicker
                userId={user.id}
                owner={owner}
                repo={repoName}
                prNumber={prNumber}
                reviewers={prReviewers}
                onUpdated={() => {
                  prSync.mutate()
                }}
              />
              <LabelPicker
                userId={user.id}
                owner={owner}
                repo={repoName}
                prNumber={prNumber}
                labels={prLabels}
                onUpdated={() => {
                  prSync.mutate()
                }}
              />
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as TabType)
            }}
            items={[
              {
                value: "conversation",
                label: "Activity",
                icon: <HistoryIcon size={16} />,
              },
              {
                value: "commits",
                label: "Commits",
                icon: <GitCommitIcon size={16} />,
                count: prCommits.length || pr.commits || 0,
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
              <PRActivityFeed
                prBody={pr.body}
                prAuthor={{
                  login: pr.authorLogin,
                  avatarUrl: pr.authorAvatarUrl,
                }}
                prCreatedAt={pr.githubCreatedAt}
                events={prEvents}
                commits={prCommits}
                reviews={prReviews}
                comments={prComments}
                userId={user?.id}
                owner={owner}
                repo={repoName}
                prNumber={prNumber}
                onCommentCreated={() => {
                  prSync.mutate()
                }}
                formatTimeAgo={formatTimeAgo}
              />
            )}

            {activeTab === "commits" && (
              <PRCommitsTab commits={prCommits} formatTimeAgo={formatTimeAgo} />
            )}

            {activeTab === "files" && (
              <PRFilesTab
                key={`${owner}/${repoName}#${prNumber}`}
                files={prFiles}
                comments={prComments}
                diffOptions={diffOptions}
                userId={user?.id}
                owner={owner}
                repo={repoName}
                prNumber={prNumber}
                headSha={pr.headSha ?? undefined}
                onCommentCreated={() => {
                  prSync.mutate()
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  component: PRDetailPage,
  validateSearch: (
    search: Record<string, string | number | boolean | null | undefined>,
  ): PRFiltersSearchParams => {
    return filtersToSearchParams(parseFiltersFromSearch(search))
  },
})
