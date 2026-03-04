import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { RepoIcon } from "@primer/octicons-react"
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
  draft: boolean
  state: string
  mergeableState: string
  commentsCount: number
  reviewCommentsCount: number
  issueComments: PullRequestComment[]
  pullRequestReviews: PullRequestReview[]
  checkRuns: PullRequestCheckRun[]
}

interface PRActivityItem {
  id: string
  kind: "comment" | "review" | "check"
  title: string
  subtitle: string
  updatedAt: string | number | null
}

const formatMergeableState = (mergeableState: string): string => {
  if (mergeableState === "unknown") return "checking"
  if (mergeableState === "blocked") return "blocked"
  return mergeableState.replaceAll("_", " ")
}

function RepoPROverviewPage() {
  const { owner, repo } = Route.useParams()
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null)
  const fullName = `${owner}/${repo}`

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
  const allPRs =
    repoData?.pullRequests
      .filter((pr) => pr.state === "open")
      .map((pr) => ({
        id: pr.id,
        number: pr.number ?? 0,
        title: pr.title ?? "Untitled PR",
        draft: Boolean(pr.draft),
        state: pr.state ?? "open",
        mergeableState: pr.mergeableState ?? "unknown",
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
      })) ?? []
  const draftPRs = allPRs.filter((pr) => pr.draft)
  const needsReviewPRs = allPRs.filter(
    (pr) => !pr.draft && (pr.mergeableState === "blocked" || pr.mergeableState === "unknown"),
  )
  const readyToMergePRs = allPRs.filter(
    (pr) => !pr.draft && pr.mergeableState !== "blocked" && pr.mergeableState !== "unknown",
  )
  const selectedPR =
    allPRs.find((pr) => pr.number === selectedPrNumber) ??
    (selectedPrNumber === null ? allPRs[0] : null) ??
    null

  const onSelectedPRChange = (nextPrNumber: number) => {
    setSelectedPrNumber(nextPrNumber)
  }

  if (!repoData) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Repository not found</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link
          to="/"
          search={{ github: undefined, error: undefined, message: undefined }}
          className={styles.backLink}
        >
          ← Back
        </Link>
        <h1 className={styles.title}>
          <RepoIcon size={20} />
          {repoData.fullName}
        </h1>
      </header>

      <div className={styles.columns}>
        <aside className={styles.column1}>
          <h2 className={styles.columnTitle}>Pull requests</h2>
          <PRSelectionList
            selectedPrNumber={selectedPR?.number ?? null}
            draftPRs={draftPRs}
            needsReviewPRs={needsReviewPRs}
            readyToMergePRs={readyToMergePRs}
            onSelectedPRChange={onSelectedPRChange}
          />
        </aside>

        <section className={styles.column2}>
          <h2 className={styles.columnTitle}>Diffs</h2>
          <div className={styles.placeholder}>
            {allPRs.length === 0 ? (
              "No PR data yet. Trigger webhooks by opening/updating a PR."
            ) : selectedPR ? (
              <div className={styles.selectedPrDetail}>
                <p className={styles.selectedPrTitle}>
                  #{selectedPR.number} {selectedPR.title}
                </p>
                <p className={styles.selectedPrMeta}>
                  {selectedPR.commentsCount + selectedPR.reviewCommentsCount} comments -{" "}
                  {formatMergeableState(selectedPR.mergeableState)}
                </p>
                <Link
                  to="/$owner/$repo/pull/$number"
                  params={{ owner, repo, number: String(selectedPR.number) }}
                  className={styles.viewPrLink}
                >
                  View PR details
                </Link>
              </div>
            ) : (
              "Select a PR from the left column."
            )}
          </div>
        </section>

        <aside className={styles.column3}>
          <h2 className={styles.columnTitle}>PR activity</h2>
          <PRActivityTimeline selectedPR={selectedPR} />
        </aside>
      </div>
    </div>
  )
}

function PRSelectionList({
  selectedPrNumber,
  draftPRs,
  needsReviewPRs,
  readyToMergePRs,
  onSelectedPRChange,
}: {
  selectedPrNumber: number | null
  draftPRs: PullRequestCard[]
  needsReviewPRs: PullRequestCard[]
  readyToMergePRs: PullRequestCard[]
  onSelectedPRChange: (nextPrNumber: number) => void
}) {
  const hasAnyPR = draftPRs.length + needsReviewPRs.length + readyToMergePRs.length > 0

  return (
    <div className={styles.prSection}>
      {!hasAnyPR && <div className={styles.prEmpty}>No open PRs</div>}
      {Boolean(draftPRs.length) && (
        <PRSelectionSection
          title="Draft"
          prs={draftPRs}
          selectedPrNumber={selectedPrNumber}
          onSelectedPRChange={onSelectedPRChange}
        />
      )}
      {Boolean(needsReviewPRs.length) && (
        <PRSelectionSection
          title="Needs Review"
          prs={needsReviewPRs}
          selectedPrNumber={selectedPrNumber}
          onSelectedPRChange={onSelectedPRChange}
        />
      )}
      {Boolean(readyToMergePRs.length) && (
        <PRSelectionSection
          title="Ready to Merge"
          prs={readyToMergePRs}
          selectedPrNumber={selectedPrNumber}
          onSelectedPRChange={onSelectedPRChange}
        />
      )}
    </div>
  )
}

function PRSelectionSection({
  title,
  prs,
  selectedPrNumber,
  onSelectedPRChange,
}: {
  title: string
  prs: PullRequestCard[]
  selectedPrNumber: number | null
  onSelectedPRChange: (nextPrNumber: number) => void
}) {
  return (
    <section className={styles.prSection}>
      <h3 className={styles.prSectionTitle}>
        <span>{title}</span>
        <span className={styles.prMetaBadge}>{prs.length}</span>
      </h3>
      <ul className={styles.prList}>
        {prs.map((pr) => {
          const isSelected = selectedPrNumber === pr.number
          return (
            <li key={pr.id}>
              <button
                type="button"
                className={`${styles.prCell} ${isSelected ? styles.prCellSelected : ""}`}
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectedPRChange(pr.number)
                }}
              >
                <span className={styles.prTitle}>
                  #{pr.number} {pr.title}
                </span>
                <span className={styles.prMetaRow}>
                  <span
                    className={`${styles.prMetaBadge} ${
                      pr.mergeableState === "blocked"
                        ? styles.prMetaBadgeBlocked
                        : styles.prMetaBadgeOpen
                    }`}
                  >
                    {formatMergeableState(pr.mergeableState)}
                  </span>
                  <span className={styles.prMetaBadge}>
                    {pr.commentsCount + pr.reviewCommentsCount} comments
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatActivityDate(dateValue: string | number | null): string {
  if (!dateValue) return "Unknown time"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return date.toLocaleString()
}

function getPRActivityItems(pr: PullRequestCard): PRActivityItem[] {
  const commentItems = pr.issueComments.map((comment) => ({
    id: `comment-${comment.id}`,
    kind: "comment" as const,
    title: `${comment.authorLogin} commented`,
    subtitle: comment.body.length > 0 ? comment.body : "No comment text",
    updatedAt: comment.updatedAt,
  }))

  const reviewItems = pr.pullRequestReviews.map((review) => ({
    id: `review-${review.id}`,
    kind: "review" as const,
    title: `${review.authorLogin} reviewed`,
    subtitle: review.state,
    updatedAt: review.updatedAt,
  }))

  const checkItems = pr.checkRuns.map((check) => ({
    id: `check-${check.id}`,
    kind: "check" as const,
    title: check.name,
    subtitle: check.conclusion ? `${check.status} (${check.conclusion})` : check.status,
    updatedAt: check.updatedAt,
  }))

  return [...commentItems, ...reviewItems, ...checkItems].sort((a, b) => {
    const firstTime = Date.parse(String(a.updatedAt ?? ""))
    const secondTime = Date.parse(String(b.updatedAt ?? ""))
    const normalizedFirstTime = Number.isNaN(firstTime) ? 0 : firstTime
    const normalizedSecondTime = Number.isNaN(secondTime) ? 0 : secondTime
    return normalizedSecondTime - normalizedFirstTime
  })
}

function PRActivityTimeline({ selectedPR }: { selectedPR: PullRequestCard | null }) {
  if (!selectedPR) {
    return <p className={styles.placeholderText}>Select a PR to view activity timeline.</p>
  }

  const activityItems = getPRActivityItems(selectedPR)

  return (
    <div className={styles.activityPlaceholder}>
      <p className={styles.selectedPrTitle}>
        #{selectedPR.number} {selectedPR.title}
      </p>
      {activityItems.length === 0 ? (
        <p className={styles.placeholderText}>No webhook activity captured for this PR yet.</p>
      ) : (
        <ul className={styles.activityList}>
          {activityItems.map((item) => (
            <li key={item.id} className={styles.activityItem}>
              <span className={styles.activityItemKind}>{item.kind}</span>
              <p className={styles.activityItemTitle}>{item.title}</p>
              <p className={styles.activityItemSubtitle}>{item.subtitle}</p>
              <time className={styles.activityItemTime}>{formatActivityDate(item.updatedAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/")({
  component: RepoPROverviewPage,
})
