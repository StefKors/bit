import type { ReactNode } from "react"
import {
  CommentDiscussionIcon,
  EyeIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
} from "@primer/octicons-react"
import type { PullRequestCard, TimelineItem } from "./Types"

export const getPrStatusVariant = (
  pr: PullRequestCard,
): {
  variant: "open" | "merged" | "closed" | "needsReview" | "draft"
  label: string
  icon: React.ReactNode
} => {
  if (pr.merged) return { variant: "merged", label: "Merged", icon: <GitMergeIcon size={12} /> }
  if (pr.state === "closed")
    return { variant: "closed", label: "Closed", icon: <GitPullRequestClosedIcon size={12} /> }
  if (pr.draft)
    return { variant: "draft", label: "Draft", icon: <GitPullRequestDraftIcon size={12} /> }
  if (pr.mergeableState === "blocked" || pr.mergeableState === "unknown")
    return { variant: "needsReview", label: "Needs Review", icon: <GitPullRequestIcon size={12} /> }
  return { variant: "open", label: "Ready", icon: <GitPullRequestIcon size={12} /> }
}

export const getCiDotVariant = (pr: PullRequestCard): "ready" | "blocked" | "checking" => {
  if (pr.merged) return "ready"
  if (pr.mergeableState === "blocked") return "blocked"
  if (pr.mergeableState === "unknown") return "checking"
  return "ready"
}

export const buildTimeline = (pr: PullRequestCard): TimelineItem[] => {
  const items: TimelineItem[] = []
  const prAuthor = { authorLogin: pr.authorLogin, authorAvatarUrl: pr.authorAvatarUrl }

  if (pr.githubCreatedAt) {
    items.push({ type: "opened", timestamp: pr.githubCreatedAt, data: prAuthor })
  }

  for (const commit of pr.pullRequestCommits) {
    const ts = commit.authoredAt ?? commit.createdAt ?? 0
    if (ts > 0) {
      items.push({ type: "commit", timestamp: ts, data: commit })
    }
  }

  for (const review of pr.pullRequestReviews) {
    const ts = review.submittedAt ?? review.updatedAt
    if (ts) {
      items.push({ type: "review", timestamp: ts, data: review })
    }
  }

  for (const comment of pr.issueComments) {
    const ts =
      comment.createdAt > 0 ? comment.createdAt : comment.updatedAt > 0 ? comment.updatedAt : 0
    if (ts > 0) {
      items.push({
        type: "issue_comment",
        timestamp: ts,
        data: comment,
      })
    }
  }

  for (const comment of pr.pullRequestReviewComments) {
    const ts =
      comment.createdAt > 0 ? comment.createdAt : comment.updatedAt > 0 ? comment.updatedAt : 0
    if (ts > 0) {
      items.push({
        type: "review_comment",
        timestamp: ts,
        data: comment,
      })
    }
  }

  for (const evt of pr.pullRequestEvents) {
    if (evt.githubCreatedAt > 0) {
      items.push({ type: "pr_event", timestamp: evt.githubCreatedAt, data: evt })
    }
  }

  if (pr.merged && pr.githubMergedAt) {
    const mergedActor = pr.mergedByLogin
      ? { authorLogin: pr.mergedByLogin, authorAvatarUrl: pr.mergedByAvatarUrl }
      : prAuthor
    items.push({ type: "merged", timestamp: pr.githubMergedAt, data: mergedActor })
  } else if (pr.state === "closed" && pr.githubClosedAt) {
    const closedActor = pr.closedByLogin
      ? { authorLogin: pr.closedByLogin, authorAvatarUrl: pr.closedByAvatarUrl }
      : prAuthor
    items.push({ type: "closed", timestamp: pr.githubClosedAt, data: closedActor })
  }

  items.sort((a, b) => a.timestamp - b.timestamp)
  return items
}

export const getReviewBadgeVariant = (state: string): "open" | "closed" | "draft" => {
  if (state === "APPROVED") return "open"
  if (state === "CHANGES_REQUESTED") return "closed"
  return "draft"
}

export const getReviewIcon = (state: string): ReactNode => {
  if (state === "APPROVED") return <EyeIcon size={16} />
  if (state === "CHANGES_REQUESTED") return <EyeIcon size={16} />
  return <CommentDiscussionIcon size={16} />
}
