import { Link } from "@tanstack/react-router"
import {
  GitPullRequestIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  CommentIcon,
  EyeIcon,
  GitCommitIcon,
} from "@primer/octicons-react"
import type { ActivityItem } from "@/lib/dashboard-utils"
import { formatTimeAgo } from "@/lib/dashboard-utils"
import styles from "./ActivityFeed.module.css"

const ActivityIcon = ({ type }: { type: ActivityItem["type"] }) => {
  switch (type) {
    case "pr_opened":
      return <GitPullRequestIcon size={14} className={styles.iconOpen} />
    case "pr_merged":
      return <GitMergeIcon size={14} className={styles.iconMerged} />
    case "pr_closed":
      return <GitPullRequestClosedIcon size={14} className={styles.iconClosed} />
    case "review":
      return <EyeIcon size={14} className={styles.iconReview} />
    case "comment":
      return <CommentIcon size={14} className={styles.iconComment} />
    case "commit":
      return <GitCommitIcon size={14} className={styles.iconCommit} />
  }
}

const ActivityRow = ({ item }: { item: ActivityItem }) => {
  const [owner, repo] = (item.repoFullName ?? "/").split("/")
  const hasLink = owner && repo && item.prNumber

  const content = (
    <div className={styles.row}>
      <div className={styles.iconWrap}>
        <ActivityIcon type={item.type} />
      </div>
      <div className={styles.body}>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.subtitle}>{item.subtitle}</span>
      </div>
      <span className={styles.time}>{formatTimeAgo(item.timestamp)}</span>
    </div>
  )

  if (hasLink) {
    return (
      <Link
        to="/$owner/$repo/pull/$number"
        params={{ owner, repo, number: String(item.prNumber) }}
        className={styles.link}
      >
        {content}
      </Link>
    )
  }
  return content
}

interface ActivityFeedProps {
  items: ActivityItem[]
  maxItems?: number
}

export const ActivityFeed = ({ items, maxItems = 15 }: ActivityFeedProps) => {
  const displayItems = items.slice(0, maxItems)

  if (displayItems.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          No recent activity yet. Start by opening a PR or reviewing code.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.feed}>
      {displayItems.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  )
}
