import { PRListItem } from "@/features/pr/PRListItem"
import styles from "./PRDashboard.module.css"

interface PR {
  id: string
  number: number
  title: string
  state: string
  draft?: boolean | null
  merged?: boolean | null
  authorLogin?: string
  authorAvatarUrl?: string | null
  comments?: number | null
  reviewComments?: number | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
  repo?: { fullName: string } | null
}

interface PRDashboardProps {
  authoredPRs: PR[]
  reviewRequestedPRs: PR[]
}

const PRColumn = ({ title, prs, emptyText }: { title: string; prs: PR[]; emptyText: string }) => (
  <div className={styles.column}>
    <h2 className={styles.columnTitle}>{title}</h2>
    <div className={styles.list}>
      {prs.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>{emptyText}</p>
        </div>
      ) : (
        prs.map((pr) => (
          <PRListItem
            key={pr.id}
            pr={{
              number: pr.number,
              title: pr.title,
              state: pr.state as "open" | "closed",
              draft: pr.draft ?? false,
              merged: pr.merged ?? false,
              authorLogin: pr.authorLogin ?? "",
              authorAvatarUrl: pr.authorAvatarUrl,
              comments: pr.comments ?? 0,
              reviewComments: pr.reviewComments ?? 0,
              githubCreatedAt: pr.githubCreatedAt,
              githubUpdatedAt: pr.githubUpdatedAt,
            }}
            repoFullName={pr.repo?.fullName ?? ""}
            isApproved={pr.merged === true}
          />
        ))
      )}
    </div>
  </div>
)

export const PRDashboard = ({ authoredPRs, reviewRequestedPRs }: PRDashboardProps) => (
  <section className={styles.dashboard}>
    <div className={styles.columns}>
      <PRColumn
        title="Authored by you"
        prs={authoredPRs}
        emptyText="No open PRs authored by you."
      />
      <PRColumn
        title="Review requested"
        prs={reviewRequestedPRs}
        emptyText="No PRs currently requesting your review."
      />
    </div>
  </section>
)
