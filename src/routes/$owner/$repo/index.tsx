import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { motion } from "motion/react"
import {
  ChevronDownIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  SyncIcon,
} from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { formatRelativeTime } from "@/lib/format"
import { AuthorLabel } from "@/components/AuthorLabel"
import { StatusBadge } from "@/components/StatusBadge"
import { BranchLabel } from "@/components/BranchLabel"
import { CiDot } from "@/components/CiDot"
import { db } from "@/lib/instantDb"
import styles from "./index.module.css"

interface PullRequestComment {
  id: string
  authorLogin: string
  body: string
  updatedAt: string | number | null
}

interface PullRequestReview {
  id: string
  authorLogin: string
  state: string
  updatedAt: string | number | null
}

interface PullRequestCheckRun {
  id: string
  name: string
  status: string
  conclusion: string | null
  updatedAt: string | number | null
}

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
  issueComments: PullRequestComment[]
  pullRequestReviews: PullRequestReview[]
  checkRuns: PullRequestCheckRun[]
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

function RepoPROverviewPage() {
  const { owner, repo } = Route.useParams()
  const { selectedPrNumber } = Route.useSearch()
  const { user } = useAuth()
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const fullName = `${owner}/${repo}`

  const effectiveAuthorFilter = authorFilter ?? (user?.login ? "me" : "all")

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { order: { updatedAt: "desc" } },
        issueComments: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
        pullRequestReviews: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
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
    issueComments:
      pr.issueComments?.map((comment) => ({
        id: comment.id,
        authorLogin: comment.authorLogin ?? "unknown",
        body: comment.body ?? "",
        updatedAt: comment.updatedAt ?? null,
      })) ?? [],
    pullRequestReviews:
      pr.pullRequestReviews?.map((review) => ({
        id: review.id,
        authorLogin: review.authorLogin ?? "unknown",
        state: review.state ?? "COMMENTED",
        updatedAt: review.updatedAt ?? null,
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

        <section className={styles.column2}>
          {selectedPR ? (
            <PRDetailContent pr={selectedPR} />
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
            <PRConversation pr={selectedPR} />
          ) : (
            <p className={styles.placeholderText}>Select a PR to view conversation.</p>
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

function PRDetailContent({ pr }: { pr: PullRequestCard }) {
  return (
    <div className={styles.detailContent}>
      {pr.body && <p className={styles.prBody}>{pr.body}</p>}

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Checks</h3>
        {pr.checkRuns.length > 0 ? (
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
        ) : (
          <p className={styles.detailEmpty}>No check runs captured yet.</p>
        )}
      </div>
    </div>
  )
}

function PRConversation({ pr }: { pr: PullRequestCard }) {
  return (
    <div className={styles.detailContent}>
      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Reviews</h3>
        {pr.pullRequestReviews.length > 0 ? (
          <ul className={styles.detailList}>
            {pr.pullRequestReviews.map((review) => (
              <li key={review.id} className={styles.detailListItem}>
                <AuthorLabel login={review.authorLogin} size={14} />
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
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailEmpty}>No reviews yet.</p>
        )}
      </div>

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>Conversation</h3>
        {pr.issueComments.length > 0 ? (
          <ul className={styles.commentList}>
            {pr.issueComments.map((comment) => (
              <li key={comment.id} className={styles.commentItem}>
                <div className={styles.commentHeader}>
                  <AuthorLabel login={comment.authorLogin} size={14} />
                  <time className={styles.commentTime}>
                    {formatRelativeTime(comment.updatedAt)}
                  </time>
                </div>
                {comment.body && <p className={styles.commentBody}>{comment.body}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailEmpty}>No comments yet.</p>
        )}
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
