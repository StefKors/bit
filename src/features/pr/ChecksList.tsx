import styles from "./ChecksList.module.css"

export type PullRequestCheck = {
  id: string
  name?: string | null
  status?: string | null
  conclusion?: string | null
  detailsUrl?: string | null
  htmlUrl?: string | null
}

type ChecksListProps = {
  checks: readonly PullRequestCheck[]
}

const getStatusBadge = (check: PullRequestCheck): { label: string; className: string } => {
  if (check.status !== "completed") return { label: "Running", className: styles.pending }

  switch (check.conclusion) {
    case "success":
    case "neutral":
    case "skipped":
      return { label: "Passed", className: styles.success }
    case "failure":
    case "timed_out":
    case "action_required":
      return { label: "Failed", className: styles.failure }
    default:
      return { label: "Completed", className: styles.pending }
  }
}

export const ChecksList = ({ checks }: ChecksListProps) => {
  if (checks.length === 0) {
    return (
      <section className={styles.container}>
        <h3 className={styles.title}>Checks</h3>
        <p className={styles.empty}>No checks reported yet.</p>
      </section>
    )
  }

  return (
    <section className={styles.container}>
      <h3 className={styles.title}>Checks</h3>
      <ul className={styles.list}>
        {checks.map((check) => {
          const statusBadge = getStatusBadge(check)
          const checkName = check.name || "Unnamed check"
          const href = check.htmlUrl || check.detailsUrl || null

          return (
            <li key={check.id} className={styles.item}>
              <span className={styles.name}>{checkName}</span>
              <span className={`${styles.badge} ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
              {href && (
                <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
                  Details
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
