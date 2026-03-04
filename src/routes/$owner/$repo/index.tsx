import { createFileRoute, Link } from "@tanstack/react-router"
import { RepoIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import styles from "./index.module.css"

function RepoPROverviewPage() {
  const { owner, repo } = Route.useParams()
  const fullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
    },
  })

  const repoData = data?.repos?.[0] ?? null

  // Placeholder PR groups - scaffold until pullRequests exist in schema
  const draftPRs: Array<{ id: string; number: number; title: string }> = []
  const needsReviewPRs: Array<{ id: string; number: number; title: string }> = []
  const readyToMergePRs: Array<{ id: string; number: number; title: string }> = []

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
          <div className={styles.placeholder}>Select a PR to view diffs</div>
        </section>

        <aside className={styles.column3}>
          <h2 className={styles.columnTitle}>PR activity</h2>
          <div className={styles.activityPlaceholder}>
            <p className={styles.placeholderText}>Comments</p>
            <p className={styles.placeholderText}>CI status</p>
            <div className={styles.commentFormPlaceholder}>Comment form</div>
            <p className={styles.placeholderText}>CI status</p>
            <button type="button" className={styles.mergeButton} disabled>
              Merge
            </button>
          </div>
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
  prs: Array<{ id: string; number: number; title: string }>
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
                #{pr.number} {pr.title}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/")({
  component: RepoPROverviewPage,
})
