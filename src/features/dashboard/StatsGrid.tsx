import {
  GitPullRequestIcon,
  EyeIcon,
  RepoIcon,
  IssueOpenedIcon,
  StarIcon,
  GitCommitIcon,
} from "@primer/octicons-react"
import styles from "./StatsGrid.module.css"

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}

const StatCard = ({ label, value, icon, color }: StatCardProps) => (
  <div className={styles.card}>
    <div className={styles.cardIcon} style={{ color }}>
      {icon}
    </div>
    <div className={styles.cardBody}>
      <span className={styles.cardValue}>{value}</span>
      <span className={styles.cardLabel}>{label}</span>
    </div>
  </div>
)

interface StatsGridProps {
  openPRs: number
  pendingReviews: number
  totalRepos: number
  openIssues: number
  totalStars: number
  totalCommits: number
}

export const StatsGrid = ({
  openPRs,
  pendingReviews,
  totalRepos,
  openIssues,
  totalStars,
  totalCommits,
}: StatsGridProps) => (
  <div className={styles.grid}>
    <StatCard
      label="Open PRs"
      value={openPRs}
      icon={<GitPullRequestIcon size={18} />}
      color="var(--bit-color-accent-green)"
    />
    <StatCard
      label="Reviews"
      value={pendingReviews}
      icon={<EyeIcon size={18} />}
      color="var(--bit-color-accent-orange)"
    />
    <StatCard
      label="Repos"
      value={totalRepos}
      icon={<RepoIcon size={18} />}
      color="var(--bit-color-accent-blue)"
    />
    <StatCard
      label="Issues"
      value={openIssues}
      icon={<IssueOpenedIcon size={18} />}
      color="var(--bit-color-accent-purple)"
    />
    <StatCard label="Stars" value={totalStars} icon={<StarIcon size={18} />} color="#ffd700" />
    <StatCard
      label="Commits"
      value={totalCommits}
      icon={<GitCommitIcon size={18} />}
      color="var(--bit-color-accent-green-bright)"
    />
  </div>
)
