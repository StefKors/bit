import { Link, useParams } from "@tanstack/react-router"
import { motion } from "motion/react"
import { formatMergeableState } from "@/lib/Format"
import { db } from "@/lib/InstantDb"
import styles from "./PullDetailPage.module.css"

const fadeIn = { opacity: 0 }
const fadeInAnimate = { opacity: 1 }
const slideUp = { opacity: 0, y: 8 }
const slideUpAnimate = { opacity: 1, y: 0 }
const transition = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const }

export function PullDetailPage() {
  const { owner, repo, number } = useParams({ from: "/$owner/$repo/pull/$number" })
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
      <motion.div
        className={styles.container}
        initial={fadeIn}
        animate={fadeInAnimate}
        transition={transition}
      >
        <Link
          to="/$owner/$repo/$prNumber"
          params={{ owner, repo, prNumber: number }}
          className={styles.backLink}
        >
          ← Back to {owner}/{repo}
        </Link>
        <h1 className={styles.title}>PR #{number}</h1>
        <p className={styles.emptyState}>No webhook-backed data found for this PR yet.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={styles.container}
      initial={fadeIn}
      animate={fadeInAnimate}
      transition={transition}
    >
      <Link
        to="/$owner/$repo/$prNumber"
        params={{ owner, repo, prNumber: number }}
        className={styles.backLink}
      >
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

      <motion.section
        className={styles.section}
        initial={slideUp}
        animate={slideUpAnimate}
        transition={{ ...transition, delay: 0.02 }}
      >
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
      </motion.section>

      <motion.section
        className={styles.section}
        initial={slideUp}
        animate={slideUpAnimate}
        transition={{ ...transition, delay: 0.05 }}
      >
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
      </motion.section>

      <motion.section
        className={styles.section}
        initial={slideUp}
        animate={slideUpAnimate}
        transition={{ ...transition, delay: 0.08 }}
      >
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
      </motion.section>
    </motion.div>
  )
}
