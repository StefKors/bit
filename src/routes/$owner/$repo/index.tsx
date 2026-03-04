import { createFileRoute, Link } from "@tanstack/react-router"
import { RepoIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import styles from "./index.module.css"

interface PullRequestCard {
  id: string
  number: number
  title: string
  draft: boolean
  state: string
  mergeableState: string
  commentsCount: number
  reviewCommentsCount: number
}

function RepoPROverviewPage() {
  const { owner, repo } = Route.useParams()
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
      })) ?? []
  const draftPRs = allPRs.filter((pr) => pr.draft)
  const needsReviewPRs = allPRs.filter(
    (pr) => !pr.draft && (pr.mergeableState === "blocked" || pr.mergeableState === "unknown"),
  )
  const readyToMergePRs = allPRs.filter(
    (pr) => !pr.draft && pr.mergeableState !== "blocked" && pr.mergeableState !== "unknown",
  )
  const latestComments = repoData?.pullRequests?.flatMap((pr) => pr.issueComments ?? []) ?? []
  const latestReviews = repoData?.pullRequests?.flatMap((pr) => pr.pullRequestReviews ?? []) ?? []
  const latestChecks = repoData?.pullRequests?.flatMap((pr) => pr.checkRuns ?? []) ?? []

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
          <PRListSection title="Draft" prs={draftPRs} owner={owner} repo={repo} />
          <PRListSection title="Needs Review" prs={needsReviewPRs} owner={owner} repo={repo} />
          <PRListSection title="Ready to Merge" prs={readyToMergePRs} owner={owner} repo={repo} />
        </aside>

        <section className={styles.column2}>
          <h2 className={styles.columnTitle}>Diffs</h2>
          <div className={styles.placeholder}>
            {allPRs.length === 0
              ? "No PR data yet. Trigger webhooks by opening/updating a PR."
              : "Open a PR from the left column to view details and activity."}
          </div>
        </section>

        <aside className={styles.column3}>
          <h2 className={styles.columnTitle}>PR activity</h2>
          <PRActivityList
            commentsCount={latestComments.length}
            reviewsCount={latestReviews.length}
            checksCount={latestChecks.length}
          />
        </aside>
      </div>
    </div>
  )
}

function PRListSection({
  title,
  prs,
  owner,
  repo,
}: {
  title: string
  prs: PullRequestCard[]
  owner: string
  repo: string
}) {
  return (
    <div className={styles.prSection}>
      <h3 className={styles.prSectionTitle}>{title}</h3>
      <ul className={styles.prList}>
        {prs.length === 0 ? (
          <li className={styles.prEmpty}>No PRs</li>
        ) : (
          prs.map((pr) => (
            <li key={pr.id}>
              <Link
                to="/$owner/$repo/pull/$number"
                params={{ owner, repo, number: String(pr.number) }}
                className={styles.prLink}
              >
                <span className={styles.prTitle}>
                  #{pr.number} {pr.title}
                </span>
                <span className={styles.prMeta}>
                  {pr.mergeableState} · {pr.commentsCount + pr.reviewCommentsCount} comments
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function PRActivityList({
  commentsCount,
  reviewsCount,
  checksCount,
}: {
  commentsCount: number
  reviewsCount: number
  checksCount: number
}) {
  return (
    <div className={styles.activityPlaceholder}>
      <p className={styles.placeholderText}>Conversation comments: {commentsCount}</p>
      <p className={styles.placeholderText}>Reviews: {reviewsCount}</p>
      <p className={styles.placeholderText}>Check runs: {checksCount}</p>
      <div className={styles.commentFormPlaceholder}>
        Activity data is now sourced from webhook payload storage.
      </div>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/")({
  component: RepoPROverviewPage,
})
