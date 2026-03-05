import { parseJsonStringArray } from "@/lib/Parse"
import type { PullRequestCard } from "./Types"

interface RepoPullRequest {
  id: string
  number?: number | null
  title?: string | null
  body?: string | null
  draft?: boolean | null
  state?: string | null
  merged?: boolean | null
  mergeableState?: string | null
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  headRef?: string | null
  baseRef?: string | null
  baseSha?: string | null
  headSha?: string | null
  updatedAt?: string | number | null
  commentsCount?: number | null
  reviewCommentsCount?: number | null
  commitsCount?: number | null
  labels?: string | null
  assignees?: string | null
  requestedReviewers?: string | null
  issueComments?: Array<{
    id: string
    githubId?: number | null
    authorLogin?: string | null
    authorAvatarUrl?: string | null
    body?: string | null
    htmlUrl?: string | null
    createdAt?: number | null
    updatedAt?: number | null
  }> | null
  pullRequestReviews?: Array<{
    id: string
    githubId?: number | null
    authorLogin?: string | null
    authorAvatarUrl?: string | null
    state?: string | null
    body?: string | null
    htmlUrl?: string | null
    submittedAt?: number | null
    updatedAt?: number | null
  }> | null
  pullRequestReviewComments?: Array<{
    id: string
    githubId?: number | null
    authorLogin?: string | null
    authorAvatarUrl?: string | null
    body?: string | null
    path?: string | null
    line?: number | null
    htmlUrl?: string | null
    createdAt?: number | null
    updatedAt?: number | null
  }> | null
  pullRequestCommits?: Array<{
    id: string
    sha?: string | null
    message?: string | null
    messageShort?: string | null
    authorLogin?: string | null
    authorAvatarUrl?: string | null
    authoredAt?: number | null
    htmlUrl?: string | null
  }> | null
  checkRuns?: Array<{
    id: string
    name?: string | null
    status?: string | null
    conclusion?: string | null
    updatedAt?: string | number | null
  }> | null
  pullRequestFiles?: Array<{
    id: string
    commitSha: string
    filename: string
    previousFilename?: string | null
    status?: string | null
    additions?: number | null
    deletions?: number | null
    patch?: string | null
  }> | null
}

export const mapPrToCard = (pr: RepoPullRequest): PullRequestCard => ({
  id: pr.id,
  number: pr.number ?? 0,
  title: pr.title ?? "Untitled PR",
  body: pr.body ?? null,
  draft: Boolean(pr.draft),
  state: pr.state ?? "open",
  merged: Boolean(pr.merged),
  mergeableState: pr.mergeableState ?? "unknown",
  authorLogin: pr.authorLogin ?? "unknown",
  authorAvatarUrl: pr.authorAvatarUrl ?? null,
  headRef: pr.headRef ?? "head",
  baseRef: pr.baseRef ?? "base",
  baseSha: pr.baseSha ?? null,
  headSha: pr.headSha ?? null,
  updatedAt: pr.updatedAt ?? null,
  commentsCount: pr.commentsCount ?? 0,
  reviewCommentsCount: pr.reviewCommentsCount ?? 0,
  commitsCount: pr.commitsCount ?? 0,
  labels: parseJsonStringArray(pr.labels),
  assignees: parseJsonStringArray(pr.assignees),
  requestedReviewers: parseJsonStringArray(pr.requestedReviewers),
  issueComments:
    pr.issueComments?.map((comment) => ({
      id: comment.id,
      githubId: comment.githubId ?? 0,
      authorLogin: comment.authorLogin ?? "unknown",
      authorAvatarUrl: comment.authorAvatarUrl ?? null,
      body: comment.body ?? "",
      htmlUrl: comment.htmlUrl ?? null,
      createdAt: comment.createdAt ?? 0,
      updatedAt: comment.updatedAt ?? 0,
    })) ?? [],
  pullRequestReviews:
    pr.pullRequestReviews?.map((review) => ({
      id: review.id,
      githubId: review.githubId ?? 0,
      authorLogin: review.authorLogin ?? "unknown",
      authorAvatarUrl: review.authorAvatarUrl ?? null,
      state: review.state ?? "COMMENTED",
      body: review.body ?? null,
      htmlUrl: review.htmlUrl ?? null,
      submittedAt: review.submittedAt ?? null,
      updatedAt: review.updatedAt ?? 0,
    })) ?? [],
  pullRequestReviewComments:
    pr.pullRequestReviewComments?.map((comment) => ({
      id: comment.id,
      githubId: comment.githubId ?? 0,
      authorLogin: comment.authorLogin ?? "unknown",
      authorAvatarUrl: comment.authorAvatarUrl ?? null,
      body: comment.body ?? null,
      path: comment.path ?? null,
      line: comment.line ?? null,
      htmlUrl: comment.htmlUrl ?? null,
      createdAt: comment.createdAt ?? 0,
      updatedAt: comment.updatedAt ?? 0,
    })) ?? [],
  pullRequestCommits:
    pr.pullRequestCommits?.map((commit) => ({
      id: commit.id,
      sha: commit.sha ?? "",
      message: commit.message ?? null,
      messageShort: commit.messageShort ?? null,
      authorLogin: commit.authorLogin ?? null,
      authorAvatarUrl: commit.authorAvatarUrl ?? null,
      authoredAt: commit.authoredAt ?? null,
      htmlUrl: commit.htmlUrl ?? null,
    })) ?? [],
  checkRuns:
    pr.checkRuns?.map((check) => ({
      id: check.id,
      name: check.name ?? "Check",
      status: check.status ?? "unknown",
      conclusion: check.conclusion ?? null,
      updatedAt: check.updatedAt ?? null,
    })) ?? [],
  pullRequestFiles:
    pr.pullRequestFiles?.map((file) => ({
      id: file.id,
      commitSha: file.commitSha,
      filename: file.filename,
      previousFilename: file.previousFilename,
      status: file.status ?? "modified",
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    })) ?? [],
})
