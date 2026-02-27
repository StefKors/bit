import { Link } from "@tanstack/react-router"
import {
  AlertIcon,
  EyeIcon,
  ClockIcon,
  GitPullRequestDraftIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react"
import type { NextAction } from "@/lib/dashboard-utils"
import styles from "./NextActions.module.css"

const ActionIcon = ({ type }: { type: NextAction["type"] }) => {
  switch (type) {
    case "failing_ci":
      return <AlertIcon size={14} />
    case "review_requested":
      return <EyeIcon size={14} />
    case "stale_pr":
      return <ClockIcon size={14} />
    case "draft_pr":
      return <GitPullRequestDraftIcon size={14} />
    case "open_issue":
      return <IssueOpenedIcon size={14} />
  }
}

const priorityColors: Record<NextAction["priority"], string> = {
  high: "var(--bit-color-accent-red)",
  medium: "var(--bit-color-accent-orange)",
  low: "rgba(var(--bit-rgb-fg), 0.45)",
}

const ActionRow = ({ action }: { action: NextAction }) => {
  const [owner, repo] = (action.repoFullName ?? "/").split("/")
  const hasPRLink = owner && repo && action.prNumber
  const hasIssueLink = owner && repo && action.issueNumber

  const content = (
    <div className={styles.row}>
      <div className={styles.iconWrap} style={{ color: priorityColors[action.priority] }}>
        <ActionIcon type={action.type} />
      </div>
      <div className={styles.body}>
        <span className={styles.title}>{action.title}</span>
        <span className={styles.subtitle}>{action.subtitle}</span>
      </div>
      <span className={styles.badge} style={{ color: priorityColors[action.priority] }}>
        {action.priority}
      </span>
    </div>
  )

  if (hasPRLink) {
    return (
      <Link
        to="/$owner/$repo/pull/$number"
        params={{ owner, repo, number: String(action.prNumber) }}
        className={styles.link}
      >
        {content}
      </Link>
    )
  }

  if (hasIssueLink) {
    return (
      <Link
        to="/$owner/$repo/issues/$number"
        params={{ owner, repo, number: String(action.issueNumber) }}
        className={styles.link}
      >
        {content}
      </Link>
    )
  }

  return content
}

type NextActionsProps = {
  actions: NextAction[]
  maxItems?: number
}

export const NextActions = ({ actions, maxItems = 8 }: NextActionsProps) => {
  const displayActions = actions.slice(0, maxItems)

  if (displayActions.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>All clear! No pending actions.</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {displayActions.map((action) => (
        <ActionRow key={action.id} action={action} />
      ))}
    </div>
  )
}
