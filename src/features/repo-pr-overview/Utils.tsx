import type { ReactNode } from "react"
import {
  CommentDiscussionIcon,
  EyeIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
} from "@primer/octicons-react"
import type { PullRequestCard, PullRequestCheckRun, TimelineItem } from "./Types"

export const getCheckRunsCiVariant = (
  checkRuns: PullRequestCheckRun[],
): "ready" | "blocked" | "checking" | null => {
  if (checkRuns.length === 0) return null
  const hasFailure = checkRuns.some(
    (c) =>
      c.conclusion === "failure" || c.conclusion === "cancelled" || c.conclusion === "timed_out",
  )
  const hasInProgress = checkRuns.some((c) => c.status === "in_progress" || !c.conclusion)
  if (hasFailure) return "blocked"
  if (hasInProgress) return "checking"
  return "ready"
}

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

  const repliesByParent = new Map<number, typeof pr.pullRequestReviewComments>()
  for (const comment of pr.pullRequestReviewComments) {
    if (comment.inReplyToId != null) {
      const list = repliesByParent.get(comment.inReplyToId) ?? []
      list.push(comment)
      repliesByParent.set(comment.inReplyToId, list)
    }
  }

  for (const review of pr.pullRequestReviews) {
    const ts = review.submittedAt ?? review.updatedAt
    if (ts) {
      const nestedCommentThreads = pr.pullRequestReviewComments
        .filter(
          (c) =>
            c.inReplyToId == null &&
            c.pullRequestReviewId != null &&
            c.pullRequestReviewId === review.githubId,
        )
        .map((root) => ({
          root,
          replies: (repliesByParent.get(root.githubId) ?? []).toSorted(
            (a, b) => a.createdAt - b.createdAt,
          ),
        }))
      items.push({
        type: "review",
        timestamp: ts,
        data: { ...review, nestedCommentThreads },
      })
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
    if (comment.inReplyToId != null) continue
    if (comment.pullRequestReviewId != null) continue
    const ts =
      comment.createdAt > 0 ? comment.createdAt : comment.updatedAt > 0 ? comment.updatedAt : 0
    if (ts > 0) {
      const replies = (repliesByParent.get(comment.githubId) ?? []).toSorted(
        (a, b) => a.createdAt - b.createdAt,
      )
      items.push({
        type: "review_comment",
        timestamp: ts,
        data: { root: comment, replies },
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

  return items.toSorted((a, b) => a.timestamp - b.timestamp)
}

export const getReviewBadgeVariant = (state: string): "open" | "closed" | "draft" => {
  if (state === "APPROVED") return "open"
  if (state === "CHANGES_REQUESTED") return "closed"
  return "draft"
}

export const getReviewIcon = (state: string): ReactNode => {
  if (state === "APPROVED") return <EyeIcon size={12} />
  if (state === "CHANGES_REQUESTED") return <EyeIcon size={12} />
  return <CommentDiscussionIcon size={12} />
}
