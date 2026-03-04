import { createFileRoute, Link } from "@tanstack/react-router"
import { db } from "@/lib/instantDb"
import styles from "./pull.$number.module.css"

const formatMergeableState = (mergeableState: string | null | undefined): string => {
  if (!mergeableState || mergeableState === "unknown") return "checking"
  return mergeableState.replaceAll("_", " ")
}

function PullDetailPage() {
  const { owner, repo, number } = Route.useParams()
  const fullName = `${owner}/${repo}`
  const prNumber = Number(number)

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: {
          where: { number: prNumber },
          limit: 1,
        },
        issueComments: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        pullRequestReviews: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        pullRequestReviewComments: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        pullRequestReviewThreads: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        checkRuns: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        checkSuites: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
      },
    },
  })
  const repoData = data?.repos?.[0]
  const pr = repoData?.pullRequests?.[0]

  if (!pr) {
    return (
      <div className={styles.container}>
        <Link to="/$owner/$repo" params={{ owner, repo }} className={styles.backLink}>
          ← Back to {owner}/{repo}
        </Link>
        <h1 className={styles.title}>PR #{number}</h1>
        <p className={styles.emptyState}>No webhook-backed data found for this PR yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Link to="/$owner/$repo" params={{ owner, repo }} className={styles.backLink}>
        ← Back to {owner}/{repo}
      </Link>
      <h1 className={styles.title}>
        #{pr.number} {pr.title ?? "Untitled PR"}
      </h1>
      <p className={styles.meta}>
        <span
          className={`${styles.metaPill} ${
            pr.state === "open" ? styles.metaStateOpen : styles.metaStateBlocked
          }`}
        >
          {pr.state ?? "unknown"}
        </span>
        <span
          className={`${styles.metaPill} ${
            pr.mergeableState === "blocked" ? styles.metaStateBlocked : styles.metaStateOpen
          }`}
        >
          {formatMergeableState(pr.mergeableState)}
        </span>
        <span className={styles.metaPill}>{pr.draft ? "draft" : "ready for review"}</span>
      </p>

      {pr.body && <p className={styles.body}>{pr.body}</p>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Checks</h2>
        <ul className={styles.list}>
          {pr.checkRuns?.length ? (
            pr.checkRuns.map((check) => (
              <li key={check.id} className={styles.listItem}>
                {check.name ?? "Check"} - {check.status ?? "unknown"}
                {check.conclusion ? ` (${check.conclusion})` : ""}
              </li>
            ))
          ) : (
            <li className={styles.emptyItem}>No check runs captured</li>
          )}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Conversation</h2>
        <ul className={styles.list}>
          {pr.issueComments?.length ? (
            pr.issueComments.map((comment) => (
              <li key={comment.id} className={styles.listItem}>
                <strong>{comment.authorLogin ?? "unknown"}</strong>: {comment.body ?? ""}
              </li>
            ))
          ) : (
            <li className={styles.emptyItem}>No issue comments captured</li>
          )}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reviews</h2>
        <ul className={styles.list}>
          {pr.pullRequestReviews?.length ? (
            pr.pullRequestReviews.map((review) => (
              <li key={review.id} className={styles.listItem}>
                <strong>{review.authorLogin ?? "unknown"}</strong> - {review.state ?? "COMMENTED"}
              </li>
            ))
          ) : (
            <li className={styles.emptyItem}>No reviews captured</li>
          )}
        </ul>
      </section>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  component: PullDetailPage,
})
