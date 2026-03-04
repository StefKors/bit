import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { motion } from "motion/react"
import {
  ChevronDownIcon,
  CodeIcon,
  CommentDiscussionIcon,
  EyeIcon,
  GitCommitIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  SyncIcon,
} from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { formatRelativeTime } from "@/lib/format"
import { Avatar } from "@/components/Avatar"
import { AuthorLabel } from "@/components/AuthorLabel"
import { Markdown } from "@/components/Markdown"
import { StatusBadge } from "@/components/StatusBadge"
import { BranchLabel } from "@/components/BranchLabel"
import { CiDot } from "@/components/CiDot"
import { Tabs } from "@/components/Tabs"
import { db } from "@/lib/instantDb"
import styles from "./index.module.css"

interface PullRequestComment {
  id: string
  githubId: number
  authorLogin: string
  authorAvatarUrl: string | null
  body: string
  htmlUrl: string | null
  createdAt: number
  updatedAt: number
}

interface PullRequestReview {
  id: string
  githubId: number
  authorLogin: string
  authorAvatarUrl: string | null
  state: string
  body: string | null
  htmlUrl: string | null
  submittedAt: number | null
  updatedAt: number
}

interface PullRequestReviewComment {
  id: string
  githubId: number
  authorLogin: string
  authorAvatarUrl: string | null
  body: string | null
  path: string | null
  line: number | null
  htmlUrl: string | null
  createdAt: number
  updatedAt: number
}

interface PullRequestCommit {
  id: string
  sha: string
  message: string | null
  messageShort: string | null
  authorLogin: string | null
  authorAvatarUrl: string | null
  authoredAt: number | null
  htmlUrl: string | null
}

interface PullRequestCheckRun {
  id: string
  name: string
  status: string
  conclusion: string | null
  updatedAt: string | number | null
}

type TimelineItem =
  | { type: "commit"; timestamp: number; data: PullRequestCommit }
  | { type: "review"; timestamp: number; data: PullRequestReview }
  | { type: "issue_comment"; timestamp: number; data: PullRequestComment }
  | { type: "review_comment"; timestamp: number; data: PullRequestReviewComment }

interface PullRequestCard {
  id: string
  number: number
  title: string
  body: string | null
  draft: boolean
  state: string
  merged: boolean
  mergeableState: string
  authorLogin: string
  authorAvatarUrl: string | null
  headRef: string
  baseRef: string
  updatedAt: string | number | null
  commentsCount: number
  reviewCommentsCount: number
  commitsCount: number
  labels: string[]
  assignees: string[]
  requestedReviewers: string[]
  issueComments: PullRequestComment[]
  pullRequestReviews: PullRequestReview[]
  pullRequestReviewComments: PullRequestReviewComment[]
  pullRequestCommits: PullRequestCommit[]
  checkRuns: PullRequestCheckRun[]
}

const parseJsonStringArray = (value: string | null | undefined): string[] => {
  if (!value) return []
  try {
    const parsed: string[] = JSON.parse(value) as string[]
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

const formatMergeableState = (mergeableState: string): string => {
  if (mergeableState === "unknown") return "checking"
  if (mergeableState === "blocked") return "blocked"
  return mergeableState.replaceAll("_", " ")
}

const getPrStatusVariant = (
  pr: PullRequestCard,
): {
  variant: "open" | "merged" | "closed" | "needsReview" | "draft"
  label: string
  icon: React.ReactNode
} => {
  if (pr.merged) return { variant: "merged", label: "Merged", icon: <GitMergeIcon size={12} /> }
  if (pr.state === "closed")
    return { variant: "closed", label: "Closed", icon: <GitPullRequestClosedIcon size={12} /> }
  if (pr.draft)
    return { variant: "draft", label: "Draft", icon: <GitPullRequestDraftIcon size={12} /> }
  if (pr.mergeableState === "blocked" || pr.mergeableState === "unknown")
    return { variant: "needsReview", label: "Needs Review", icon: <GitPullRequestIcon size={12} /> }
  return { variant: "open", label: "Ready", icon: <GitPullRequestIcon size={12} /> }
}

const getCiDotVariant = (pr: PullRequestCard): "ready" | "blocked" | "checking" => {
  if (pr.merged) return "ready"
  if (pr.mergeableState === "blocked") return "blocked"
  if (pr.mergeableState === "unknown") return "checking"
  return "ready"
}

function SelectedPRHeader({ pr }: { pr: PullRequestCard }) {
  const status = getPrStatusVariant(pr)
  const totalComments = pr.commentsCount + pr.reviewCommentsCount

  return (
    <div className={styles.selectedPrHeader}>
      <span className={styles.selectedPrHeaderTop}>
        <span className={styles.selectedPrHeaderTitle}>
          <span className={styles.selectedPrHeaderNumber}>#{pr.number}</span>
          {pr.title}
        </span>
        <span className={styles.selectedPrHeaderDate}>{formatRelativeTime(pr.updatedAt)}</span>
      </span>

      <span className={styles.selectedPrHeaderBottom}>
        <StatusBadge variant={status.variant} icon={status.icon}>
          {status.label}
        </StatusBadge>
        <AuthorLabel login={pr.authorLogin} avatarUrl={pr.authorAvatarUrl} size={14} />
        <span className={styles.selectedPrHeaderSep} aria-hidden>
          ·
        </span>
        <BranchLabel head={pr.headRef} base={pr.baseRef} />
        {Boolean(totalComments) && (
          <span className={styles.selectedPrHeaderComments}>
            {totalComments} comment{totalComments !== 1 ? "s" : ""}
          </span>
        )}
        <CiDot
          variant={getCiDotVariant(pr)}
          title={pr.merged ? "Merged" : formatMergeableState(pr.mergeableState)}
        />
      </span>
    </div>
  )
}

function PRAuthorFilter({
  authorFilter,
  userLogin,
  uniqueAuthors,
  onFilterChange,
}: {
  authorFilter: string
  userLogin: string | null
  uniqueAuthors: string[]
  onFilterChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  const isSpecificAuthor = authorFilter !== "all" && authorFilter !== "me"
  const displayLogin = isSpecificAuthor ? authorFilter : null

  return (
    <div className={styles.authorFilter}>
      <div className={styles.authorFilterPills}>
        <button
          type="button"
          className={`${styles.authorPill} ${authorFilter === "all" ? styles.authorPillActive : ""}`}
          onClick={() => {
            onFilterChange("all")
          }}
        >
          All
        </button>
        {userLogin && (
          <button
            type="button"
            className={`${styles.authorPill} ${authorFilter === "me" ? styles.authorPillActive : ""}`}
            onClick={() => {
              onFilterChange("me")
            }}
          >
            Mine
          </button>
        )}
        <div className={styles.authorDropdownWrap}>
          <button
            type="button"
            className={`${styles.authorPill} ${isSpecificAuthor ? styles.authorPillActive : ""}`}
            onClick={() => {
              setOpen((prev) => !prev)
            }}
            aria-expanded={open}
          >
            {displayLogin ? (
              <AuthorLabel login={displayLogin} size={12} />
            ) : (
              <>
                Author <ChevronDownIcon size={10} />
              </>
            )}
          </button>
          {open && (
            <div className={styles.authorDropdown}>
              {uniqueAuthors.map((login) => (
                <button
                  key={login}
                  type="button"
                  className={`${styles.authorDropdownItem} ${authorFilter === login ? styles.authorDropdownItemActive : ""}`}
                  onClick={() => {
                    onFilterChange(login)
                    setOpen(false)
                  }}
                >
                  <AuthorLabel login={login} size={14} />
                </button>
              ))}
              {uniqueAuthors.length === 0 && (
                <span className={styles.authorDropdownEmpty}>No authors</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PR_TABS = [
  { value: "conversation", label: "Conversation" },
  { value: "files", label: "Files Changed" },
]

function RepoPROverviewPage() {
  const { owner, repo } = Route.useParams()
  const { selectedPrNumber } = Route.useSearch()
  const { user } = useAuth()
  const [prTab, setPrTab] = useState("conversation")
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const fullName = `${owner}/${repo}`

  const effectiveAuthorFilter = authorFilter ?? (user?.login ? "me" : "all")

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { order: { updatedAt: "desc" } },
        issueComments: {
          $: { order: { updatedAt: "desc" } },
        },
        pullRequestReviews: {
          $: { order: { updatedAt: "desc" } },
        },
        pullRequestReviewComments: {
          $: { order: { updatedAt: "desc" } },
        },
        pullRequestCommits: {
          $: { order: { updatedAt: "desc" } },
        },
        checkRuns: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
      },
    },
  })

  const repoData = data?.repos?.[0] ?? null
  type RepoPullRequest = NonNullable<typeof repoData>["pullRequests"][number]
  const mapPrToCard = (pr: RepoPullRequest): PullRequestCard => ({
    id: pr.id,
    number: pr.number ?? 0,
    title: pr.title ?? "Untitled PR",
    body: pr.body ?? null,
    draft: Boolean(pr.draft),
    state: pr.state ?? "open",
    merged: Boolean(pr.merged),
    mergeableState: pr.mergeableState ?? "unknown",
    authorLogin: pr.authorLogin ?? "unknown",
    authorAvatarUrl: pr.authorAvatarUrl ?? null,
    headRef: pr.headRef ?? "head",
    baseRef: pr.baseRef ?? "base",
    updatedAt: pr.updatedAt ?? null,
    commentsCount: pr.commentsCount ?? 0,
    reviewCommentsCount: pr.reviewCommentsCount ?? 0,
    commitsCount: pr.commitsCount ?? 0,
    labels: parseJsonStringArray(pr.labels),
    assignees: parseJsonStringArray(pr.assignees),
    requestedReviewers: parseJsonStringArray(pr.requestedReviewers),
    issueComments:
      pr.issueComments?.map((comment) => ({
        id: comment.id,
        githubId: comment.githubId ?? 0,
        authorLogin: comment.authorLogin ?? "unknown",
        authorAvatarUrl: comment.authorAvatarUrl ?? null,
        body: comment.body ?? "",
        htmlUrl: comment.htmlUrl ?? null,
        createdAt: comment.createdAt ?? 0,
        updatedAt: comment.updatedAt ?? 0,
      })) ?? [],
    pullRequestReviews:
      pr.pullRequestReviews?.map((review) => ({
        id: review.id,
        githubId: review.githubId ?? 0,
        authorLogin: review.authorLogin ?? "unknown",
        authorAvatarUrl: review.authorAvatarUrl ?? null,
        state: review.state ?? "COMMENTED",
        body: review.body ?? null,
        htmlUrl: review.htmlUrl ?? null,
        submittedAt: review.submittedAt ?? null,
        updatedAt: review.updatedAt ?? 0,
      })) ?? [],
    pullRequestReviewComments:
      pr.pullRequestReviewComments?.map((comment) => ({
        id: comment.id,
        githubId: comment.githubId ?? 0,
        authorLogin: comment.authorLogin ?? "unknown",
        authorAvatarUrl: comment.authorAvatarUrl ?? null,
        body: comment.body ?? null,
        path: comment.path ?? null,
        line: comment.line ?? null,
        htmlUrl: comment.htmlUrl ?? null,
        createdAt: comment.createdAt ?? 0,
        updatedAt: comment.updatedAt ?? 0,
      })) ?? [],
    pullRequestCommits:
      pr.pullRequestCommits?.map((commit) => ({
        id: commit.id,
        sha: commit.sha ?? "",
        message: commit.message ?? null,
        messageShort: commit.messageShort ?? null,
        authorLogin: commit.authorLogin ?? null,
        authorAvatarUrl: commit.authorAvatarUrl ?? null,
        authoredAt: commit.authoredAt ?? null,
        htmlUrl: commit.htmlUrl ?? null,
      })) ?? [],
    checkRuns:
      pr.checkRuns?.map((check) => ({
        id: check.id,
        name: check.name ?? "Check",
        status: check.status ?? "unknown",
        conclusion: check.conclusion ?? null,
        updatedAt: check.updatedAt ?? null,
      })) ?? [],
  })

  const allPRs = repoData?.pullRequests.filter((pr) => pr.state === "open").map(mapPrToCard) ?? []
  const mergedPRs = repoData?.pullRequests.filter((pr) => pr.merged === true).map(mapPrToCard) ?? []

  const uniqueAuthors = [
    ...new Set(
      [...allPRs, ...mergedPRs]
        .map((pr) => pr.authorLogin)
        .filter((login): login is string => login !== "unknown"),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const authorLoginFilter =
    effectiveAuthorFilter === "me" && user?.login
      ? user.login
      : effectiveAuthorFilter !== "all" && effectiveAuthorFilter !== "me"
        ? effectiveAuthorFilter
        : null

  const filterByAuthor = (prs: PullRequestCard[]) =>
    authorLoginFilter ? prs.filter((pr) => pr.authorLogin === authorLoginFilter) : prs

  const draftPRs = filterByAuthor(allPRs.filter((pr) => pr.draft))
  const needsReviewPRs = filterByAuthor(
    allPRs.filter(
      (pr) => !pr.draft && (pr.mergeableState === "blocked" || pr.mergeableState === "unknown"),
    ),
  )
  const readyToMergePRs = filterByAuthor(
    allPRs.filter(
      (pr) => !pr.draft && pr.mergeableState !== "blocked" && pr.mergeableState !== "unknown",
    ),
  )
  const filteredMergedPRs = filterByAuthor(mergedPRs)
  const parsedSelectedPrNumber = selectedPrNumber ? Number(selectedPrNumber) : NaN
  const normalizedSelectedPrNumber = Number.isNaN(parsedSelectedPrNumber)
    ? null
    : parsedSelectedPrNumber
  const allFilteredPRs = [...draftPRs, ...needsReviewPRs, ...readyToMergePRs, ...filteredMergedPRs]
  const prevPrIdsRef = useRef<Set<string>>(new Set())
  const hasInitiallyLoadedRef = useRef(false)
  const ownerRepoRef = useRef(fullName)
  if (ownerRepoRef.current !== fullName) {
    ownerRepoRef.current = fullName
    hasInitiallyLoadedRef.current = false
    prevPrIdsRef.current = new Set()
  }
  const currentIds = new Set(allFilteredPRs.map((pr) => pr.id))
  if (!hasInitiallyLoadedRef.current) {
    hasInitiallyLoadedRef.current = true
    prevPrIdsRef.current = new Set(currentIds)
  }
  const newPrIds = new Set([...currentIds].filter((id) => !prevPrIdsRef.current.has(id)))
  prevPrIdsRef.current = currentIds

  const selectedPR =
    allFilteredPRs.find((pr) => pr.number === normalizedSelectedPrNumber) ??
    (normalizedSelectedPrNumber === null
      ? (draftPRs[0] ?? needsReviewPRs[0] ?? readyToMergePRs[0] ?? filteredMergedPRs[0])
      : null) ??
    null

  if (!repoData) {
    return (
      <motion.div
        className={styles.container}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.loading}>Repository not found</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.columns}>
        <aside className={styles.column1}>
          <PRAuthorFilter
            authorFilter={effectiveAuthorFilter}
            userLogin={user?.login ?? null}
            uniqueAuthors={uniqueAuthors}
            onFilterChange={setAuthorFilter}
          />
          <PRSelectionList
            owner={owner}
            repo={repo}
            selectedPrNumber={selectedPR?.number ?? null}
            draftPRs={draftPRs}
            needsReviewPRs={needsReviewPRs}
            readyToMergePRs={readyToMergePRs}
            mergedPRs={filteredMergedPRs}
            newPrIds={newPrIds}
          />
        </aside>

        {selectedPR && (
          <div className={styles.prHeader}>
            <SelectedPRHeader pr={selectedPR} />
          </div>
        )}

        {selectedPR && (
          <div className={styles.prTabs}>
            <Tabs items={PR_TABS} value={prTab} onValueChange={setPrTab} />
          </div>
        )}

        <section className={styles.column2}>
          {selectedPR ? (
            prTab === "conversation" ? (
              <PRDetailContent pr={selectedPR} />
            ) : (
              <div className={styles.placeholder}>Files changed view coming soon.</div>
            )
          ) : (
            <div className={styles.placeholder}>
              {allPRs.length === 0
                ? "No PR data yet. Trigger webhooks by opening/updating a PR."
                : "Select a PR from the left column."}
            </div>
          )}
        </section>

        <aside className={styles.column3}>
          {selectedPR ? (
            <PRSidebar pr={selectedPR} />
          ) : (
            <p className={styles.placeholderText}>Select a PR to view details.</p>
          )}
        </aside>
      </div>
    </motion.div>
  )
}

function PRSelectionList({
  owner,
  repo,
  selectedPrNumber,
  draftPRs,
  needsReviewPRs,
  readyToMergePRs,
  mergedPRs,
  newPrIds,
}: {
  owner: string
  repo: string
  selectedPrNumber: number | null
  draftPRs: PullRequestCard[]
  needsReviewPRs: PullRequestCard[]
  readyToMergePRs: PullRequestCard[]
  mergedPRs: PullRequestCard[]
  newPrIds: Set<string>
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    draft: true,
    needsReview: true,
    readyToMerge: true,
    merged: false,
  })

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className={styles.prSectionList}>
      <PRSelectionSection
        owner={owner}
        repo={repo}
        sectionId="draft"
        title="Draft"
        icon={<GitPullRequestDraftIcon size={12} />}
        prs={draftPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.draft}
        onToggle={() => {
          toggleSection("draft")
        }}
        newPrIds={newPrIds}
      />
      <PRSelectionSection
        owner={owner}
        repo={repo}
        sectionId="needsReview"
        title="Needs Review"
        icon={<SyncIcon size={12} />}
        prs={needsReviewPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.needsReview}
        onToggle={() => {
          toggleSection("needsReview")
        }}
        newPrIds={newPrIds}
      />
      <PRSelectionSection
        owner={owner}
        repo={repo}
        sectionId="readyToMerge"
        title="Ready to Merge"
        icon={<GitPullRequestIcon size={12} />}
        prs={readyToMergePRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.readyToMerge}
        onToggle={() => {
          toggleSection("readyToMerge")
        }}
        newPrIds={newPrIds}
      />
      <PRSelectionSection
        owner={owner}
        repo={repo}
        sectionId="merged"
        title="Merged"
        icon={<GitMergeIcon size={12} />}
        prs={mergedPRs}
        selectedPrNumber={selectedPrNumber}
        isExpanded={expanded.merged}
        onToggle={() => {
          toggleSection("merged")
        }}
        newPrIds={newPrIds}
      />
    </div>
  )
}

function PRSelectionSection({
  owner,
  repo,
  sectionId,
  title,
  icon,
  prs,
  selectedPrNumber,
  isExpanded,
  onToggle,
  newPrIds,
}: {
  owner: string
  repo: string
  sectionId: string
  title: string
  icon: React.ReactNode
  prs: PullRequestCard[]
  selectedPrNumber: number | null
  isExpanded: boolean
  onToggle: () => void
  newPrIds: Set<string>
}) {
  return (
    <section className={styles.prSection} data-section={sectionId} data-expanded={isExpanded}>
      <h3 className={styles.prSectionTitle}>
        <button
          type="button"
          className={styles.prSectionTitleButton}
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          <span className={styles.prSectionTitleIcon}>{icon}</span>
          {title}
          <span className={styles.prMetaBadge}>{prs.length}</span>
        </button>
      </h3>
      {isExpanded && prs.length > 0 && (
        <ul className={styles.prList}>
          {prs.map((pr) => {
            const isSelected = selectedPrNumber === pr.number
            const isNew = newPrIds.has(pr.id)
            return (
              <motion.li
                key={pr.id}
                initial={isNew ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to="/$owner/$repo"
                  params={{ owner, repo }}
                  search={(prev) => ({
                    ...prev,
                    selectedPrNumber: String(pr.number),
                  })}
                  preload="intent"
                  className={`${styles.prCell} ${isSelected ? styles.prCellSelected : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span className={styles.prCellRow1}>
                    <span className={styles.prTitle}>
                      #{pr.number} {pr.title}
                    </span>
                    <span className={styles.prUpdatedAt}>{formatRelativeTime(pr.updatedAt)}</span>
                  </span>
                  <span className={styles.prCellRow2}>
                    <AuthorLabel login={pr.authorLogin} avatarUrl={pr.authorAvatarUrl} />
                    <span className={styles.prMetaTrail}>
                      {pr.commentsCount + pr.reviewCommentsCount}
                      <CiDot
                        variant={getCiDotVariant(pr)}
                        title={pr.merged ? "Merged" : formatMergeableState(pr.mergeableState)}
                      />
                    </span>
                  </span>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const buildTimeline = (pr: PullRequestCard): TimelineItem[] => {
  const items: TimelineItem[] = []

  for (const commit of pr.pullRequestCommits) {
    if (commit.authoredAt) {
      items.push({ type: "commit", timestamp: commit.authoredAt, data: commit })
    }
  }

  for (const review of pr.pullRequestReviews) {
    const ts = review.submittedAt ?? review.updatedAt
    if (ts) {
      items.push({ type: "review", timestamp: ts, data: review })
    }
  }

  for (const comment of pr.issueComments) {
    items.push({
      type: "issue_comment",
      timestamp: comment.createdAt || comment.updatedAt,
      data: comment,
    })
  }

  for (const comment of pr.pullRequestReviewComments) {
    items.push({
      type: "review_comment",
      timestamp: comment.createdAt || comment.updatedAt,
      data: comment,
    })
  }

  items.sort((a, b) => a.timestamp - b.timestamp)
  return items
}

const getReviewBadgeVariant = (state: string): "open" | "closed" | "draft" => {
  if (state === "APPROVED") return "open"
  if (state === "CHANGES_REQUESTED") return "closed"
  return "draft"
}

const getReviewIcon = (state: string): React.ReactNode => {
  if (state === "APPROVED") return <EyeIcon size={12} />
  if (state === "CHANGES_REQUESTED") return <EyeIcon size={12} />
  return <CommentDiscussionIcon size={12} />
}

function TimelineCommitItem({ commit }: { commit: PullRequestCommit }) {
  const shortSha = commit.sha.slice(0, 7)

  return (
    <div className={`${styles.timelineItem} ${styles.timelineCommit}`}>
      <div className={styles.timelineIcon}>
        <GitCommitIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineCommitInfo}>
            {commit.authorLogin && (
              <Avatar src={commit.authorAvatarUrl} name={commit.authorLogin} size={16} />
            )}
            <span className={styles.timelineAuthor}>{commit.authorLogin ?? "unknown"}</span>
            <span className={styles.timelineCommitVerb}>committed</span>
          </span>
          <time className={styles.timelineTime}>{formatRelativeTime(commit.authoredAt)}</time>
        </div>
        <span className={styles.timelineCommitMessage}>
          {commit.htmlUrl ? (
            <a
              href={commit.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.timelineCommitSha}
            >
              {shortSha}
            </a>
          ) : (
            <code className={styles.timelineCommitShaPlain}>{shortSha}</code>
          )}
          {commit.messageShort ?? commit.message?.split("\n")[0] ?? ""}
        </span>
      </div>
    </div>
  )
}

function TimelineReviewItem({ review }: { review: PullRequestReview }) {
  const stateLabel = review.state.toLowerCase().replaceAll("_", " ")

  return (
    <div className={`${styles.timelineItem} ${styles.timelineReview}`}>
      <div className={styles.timelineIcon}>{getReviewIcon(review.state)}</div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineReviewInfo}>
            <AuthorLabel login={review.authorLogin} avatarUrl={review.authorAvatarUrl} size={16} />
            <StatusBadge
              variant={getReviewBadgeVariant(review.state)}
              icon={getReviewIcon(review.state)}
            >
              {stateLabel}
            </StatusBadge>
          </span>
          <time className={styles.timelineTime}>
            {formatRelativeTime(review.submittedAt ?? review.updatedAt)}
          </time>
        </div>
        {review.body && <Markdown content={review.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}

function TimelineIssueCommentItem({ comment }: { comment: PullRequestComment }) {
  return (
    <div className={`${styles.timelineItem} ${styles.timelineComment}`}>
      <div className={styles.timelineIcon}>
        <CommentDiscussionIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <AuthorLabel login={comment.authorLogin} avatarUrl={comment.authorAvatarUrl} size={16} />
          <time className={styles.timelineTime}>
            {formatRelativeTime(comment.createdAt || comment.updatedAt)}
          </time>
        </div>
        {comment.body && <Markdown content={comment.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}

function TimelineReviewCommentItem({ comment }: { comment: PullRequestReviewComment }) {
  return (
    <div className={`${styles.timelineItem} ${styles.timelineReviewComment}`}>
      <div className={styles.timelineIcon}>
        <CodeIcon size={16} />
      </div>
      <div className={styles.timelineBody}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineReviewCommentInfo}>
            <AuthorLabel
              login={comment.authorLogin}
              avatarUrl={comment.authorAvatarUrl}
              size={16}
            />
            {comment.path && (
              <code className={styles.timelineFilePath}>
                {comment.path}
                {comment.line != null ? `:${comment.line}` : ""}
              </code>
            )}
          </span>
          <time className={styles.timelineTime}>
            {formatRelativeTime(comment.createdAt || comment.updatedAt)}
          </time>
        </div>
        {comment.body && <Markdown content={comment.body} className={styles.timelineContent} />}
      </div>
    </div>
  )
}

function PRDetailContent({ pr }: { pr: PullRequestCard }) {
  const timeline = buildTimeline(pr)

  return (
    <div className={styles.detailContent}>
      {pr.body && <Markdown content={pr.body} className={styles.prBody} />}

      {pr.checkRuns.length > 0 && (
        <div className={styles.detailSection}>
          <h3 className={styles.detailSectionTitle}>Checks</h3>
          <ul className={styles.detailList}>
            {pr.checkRuns.map((check) => (
              <li key={check.id} className={styles.detailListItem}>
                <CiDot
                  variant={
                    check.conclusion === "success"
                      ? "ready"
                      : check.conclusion === "failure"
                        ? "blocked"
                        : "checking"
                  }
                />
                <span className={styles.detailListItemText}>{check.name}</span>
                <span className={styles.detailListItemMeta}>
                  {check.conclusion ?? check.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Activity</h3>
        {timeline.length > 0 ? (
          <div className={styles.timeline}>
            {timeline.map((item) => {
              if (item.type === "commit") {
                return <TimelineCommitItem key={`c-${item.data.id}`} commit={item.data} />
              }
              if (item.type === "review") {
                return <TimelineReviewItem key={`r-${item.data.id}`} review={item.data} />
              }
              if (item.type === "issue_comment") {
                return <TimelineIssueCommentItem key={`ic-${item.data.id}`} comment={item.data} />
              }
              return <TimelineReviewCommentItem key={`rc-${item.data.id}`} comment={item.data} />
            })}
          </div>
        ) : (
          <p className={styles.detailEmpty}>No activity yet.</p>
        )}
      </div>
    </div>
  )
}

function PRSidebar({ pr }: { pr: PullRequestCard }) {
  const reviewerLogins = [...new Set(pr.pullRequestReviews.map((r) => r.authorLogin))]
  const latestReviewByAuthor = new Map<string, PullRequestReview>()
  for (const review of pr.pullRequestReviews) {
    const existing = latestReviewByAuthor.get(review.authorLogin)
    if (!existing || (review.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      latestReviewByAuthor.set(review.authorLogin, review)
    }
  }

  return (
    <div className={styles.sidebarContent}>
      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Reviewers</h3>
        {reviewerLogins.length > 0 || pr.requestedReviewers.length > 0 ? (
          <ul className={styles.sidebarList}>
            {reviewerLogins.map((login) => {
              const review = latestReviewByAuthor.get(login)
              return (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} size={16} />
                  {review && (
                    <StatusBadge
                      variant={
                        review.state === "APPROVED"
                          ? "open"
                          : review.state === "CHANGES_REQUESTED"
                            ? "closed"
                            : "draft"
                      }
                    >
                      {review.state.toLowerCase().replaceAll("_", " ")}
                    </StatusBadge>
                  )}
                </li>
              )
            })}
            {pr.requestedReviewers
              .filter((login) => !reviewerLogins.includes(login))
              .map((login) => (
                <li key={login} className={styles.sidebarListItem}>
                  <AuthorLabel login={login} size={16} />
                  <span className={styles.sidebarMuted}>pending</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Assignees</h3>
        {pr.assignees.length > 0 ? (
          <ul className={styles.sidebarList}>
            {pr.assignees.map((login) => (
              <li key={login} className={styles.sidebarListItem}>
                <AuthorLabel login={login} size={16} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Labels</h3>
        {pr.labels.length > 0 ? (
          <div className={styles.labelList}>
            {pr.labels.map((label) => (
              <span key={label} className={styles.label}>
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.sidebarEmpty}>None</p>
        )}
      </div>

      <div className={styles.sidebarSection}>
        <h3 className={styles.sidebarSectionTitle}>Commits</h3>
        <p className={styles.sidebarValue}>{pr.commitsCount}</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/")({
  validateSearch: (search: { selectedPrNumber?: string }) => ({
    selectedPrNumber:
      typeof search.selectedPrNumber === "string" ? search.selectedPrNumber : undefined,
  }),
  component: RepoPROverviewPage,
})
