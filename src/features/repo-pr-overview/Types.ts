export interface PullRequestComment {
  id: string
  githubId: number
  authorLogin: string
  authorAvatarUrl: string | null
  body: string
  htmlUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface PullRequestReview {
  id: string
  githubId: number
  authorLogin: string
  authorAvatarUrl: string | null
  state: string
  body: string | null
  htmlUrl: string | null
  submittedAt: number | null
  updatedAt: number
}

export interface PullRequestReviewComment {
  id: string
  githubId: number
  nodeId: string | null
  inReplyToId: number | null
  pullRequestReviewId: number | null
  threadId: string | null
  threadResolved: boolean | null
  threadCollapsed: boolean | null
  authorLogin: string
  authorAvatarUrl: string | null
  body: string | null
  path: string | null
  line: number | null
  htmlUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface ReviewCommentThread {
  root: PullRequestReviewComment
  replies: PullRequestReviewComment[]
  isResolved: boolean
  isCollapsed: boolean
}

export interface PullRequestReviewThread {
  id: string
  threadId: string
  resolved: boolean
  payload: string | null
  createdAt: number
  updatedAt: number
}

export interface PullRequestReviewWithComments extends PullRequestReview {
  nestedCommentThreads: ReviewCommentThread[]
}

export interface PullRequestCommit {
  id: string
  sha: string
  message: string | null
  messageShort: string | null
  authorLogin: string | null
  authorAvatarUrl: string | null
  authoredAt: number | null
  createdAt: number
  htmlUrl: string | null
}

export interface PullRequestEvent {
  id: string
  eventType: string
  actorLogin: string | null
  actorAvatarUrl: string | null
  targetLogin: string | null
  targetAvatarUrl: string | null
  label: string | null
  githubCreatedAt: number
}

export interface PullRequestCheckRun {
  id: string
  name: string
  status: string
  conclusion: string | null
  updatedAt: string | number | null
}

export interface PrEventData {
  authorLogin: string
  authorAvatarUrl: string | null
}

export type TimelineItem =
  | { type: "commit"; timestamp: number; data: PullRequestCommit }
  | { type: "review"; timestamp: number; data: PullRequestReviewWithComments }
  | { type: "issue_comment"; timestamp: number; data: PullRequestComment }
  | { type: "review_comment"; timestamp: number; data: ReviewCommentThread }
  | { type: "opened"; timestamp: number; data: PrEventData }
  | { type: "merged"; timestamp: number; data: PrEventData }
  | { type: "closed"; timestamp: number; data: PrEventData }
  | { type: "pr_event"; timestamp: number; data: PullRequestEvent }

export interface PullRequestFileEntry {
  id: string
  filename: string
  previousFilename?: string | null
  status: string
  additions?: number | null
  deletions?: number | null
  patch?: string | null
}

export interface PullRequestCard {
  id: string
  number: number
  title: string
  body: string | null
  draft: boolean
  state: string
  merged: boolean
  mergeableState: string
  authorLogin: string
  authorAvatarUrl: string | null
  headRef: string
  baseRef: string
  baseSha: string | null
  headSha: string | null
  updatedAt: string | number | null
  githubCreatedAt: number | null
  githubClosedAt: number | null
  githubMergedAt: number | null
  mergedByLogin: string | null
  mergedByAvatarUrl: string | null
  closedByLogin: string | null
  closedByAvatarUrl: string | null
  commentsCount: number
  reviewCommentsCount: number
  commitsCount: number
  labels: string[]
  assignees: string[]
  requestedReviewers: string[]
  issueComments: PullRequestComment[]
  pullRequestReviews: PullRequestReview[]
  pullRequestReviewComments: PullRequestReviewComment[]
  pullRequestReviewThreads: PullRequestReviewThread[]
  pullRequestCommits: PullRequestCommit[]
  checkRuns: PullRequestCheckRun[]
  pullRequestEvents: PullRequestEvent[]
  pullRequestFiles: PullRequestFileEntry[]
}
