import { parseJsonStringArray } from "@/lib/Parse"
import type { PullRequestCard } from "./Types"

const parseThreadMetaFromPayload = (
  payload: string | null | undefined,
): {
  threadId: string | null
  threadResolved: boolean | null
  threadCollapsed: boolean | null
} => {
  if (!payload) {
    return { threadId: null, threadResolved: null, threadCollapsed: null }
  }

  try {
    const parsed = JSON.parse(payload) as {
      thread?: {
        id?: string | number
        resolved?: boolean
        isResolved?: boolean
        isCollapsed?: boolean
      }
    }
    const thread = parsed.thread
    const threadIdValue = thread?.id
    const threadId =
      typeof threadIdValue === "string" || typeof threadIdValue === "number"
        ? String(threadIdValue)
        : null
    const threadResolved =
      typeof thread?.resolved === "boolean"
        ? thread.resolved
        : typeof thread?.isResolved === "boolean"
          ? thread.isResolved
          : null
    const threadCollapsed = typeof thread?.isCollapsed === "boolean" ? thread.isCollapsed : null
    return { threadId, threadResolved, threadCollapsed }
  } catch {
    return { threadId: null, threadResolved: null, threadCollapsed: null }
  }
}

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
  githubCreatedAt?: number | null
  githubClosedAt?: number | null
  githubMergedAt?: number | null
  mergedByLogin?: string | null
  mergedByAvatarUrl?: string | null
  closedByLogin?: string | null
  closedByAvatarUrl?: string | null
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
    nodeId?: string | null
    inReplyToId?: number | null
    pullRequestReviewId?: number | null
    payload?: string | null
    authorLogin?: string | null
    authorAvatarUrl?: string | null
    body?: string | null
    path?: string | null
    line?: number | null
    htmlUrl?: string | null
    createdAt?: number | null
    updatedAt?: number | null
  }> | null
  pullRequestReviewThreads?: Array<{
    id: string
    threadId?: string | null
    resolved?: boolean | null
    payload?: string | null
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
    createdAt?: number | null
    htmlUrl?: string | null
  }> | null
  checkRuns?: Array<{
    id: string
    name?: string | null
    status?: string | null
    conclusion?: string | null
    detailsUrl?: string | null
    htmlUrl?: string | null
    updatedAt?: string | number | null
  }> | null
  checkSuites?: Array<{
    id: string
    status?: string | null
    conclusion?: string | null
    appName?: string | null
    headSha?: string | null
    updatedAt?: string | number | null
  }> | null
  commitStatuses?: Array<{
    id: string
    context?: string | null
    state?: string | null
    description?: string | null
    targetUrl?: string | null
    updatedAt?: string | number | null
  }> | null
  workflowRuns?: Array<{
    id: string
    githubId?: number | null
    name?: string | null
    status?: string | null
    conclusion?: string | null
    htmlUrl?: string | null
    runNumber?: number | null
    runAttempt?: number | null
    updatedAt?: string | number | null
  }> | null
  workflowJobs?: Array<{
    id: string
    runId?: number | null
    name?: string | null
    status?: string | null
    conclusion?: string | null
    htmlUrl?: string | null
    runUrl?: string | null
    updatedAt?: string | number | null
  }> | null
  pullRequestEvents?: Array<{
    id: string
    eventType?: string | null
    actorLogin?: string | null
    actorAvatarUrl?: string | null
    targetLogin?: string | null
    targetAvatarUrl?: string | null
    label?: string | null
    githubCreatedAt?: number | null
  }> | null
  pullRequestFiles?: Array<{
    id: string
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
  githubCreatedAt: pr.githubCreatedAt ?? null,
  githubClosedAt: pr.githubClosedAt ?? null,
  githubMergedAt: pr.githubMergedAt ?? null,
  mergedByLogin: pr.mergedByLogin ?? null,
  mergedByAvatarUrl: pr.mergedByAvatarUrl ?? null,
  closedByLogin: pr.closedByLogin ?? null,
  closedByAvatarUrl: pr.closedByAvatarUrl ?? null,
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
    pr.pullRequestReviewComments?.map((comment) => {
      const { threadId, threadResolved, threadCollapsed } = parseThreadMetaFromPayload(
        comment.payload,
      )
      return {
        id: comment.id,
        githubId: comment.githubId ?? 0,
        nodeId: comment.nodeId ?? null,
        inReplyToId: comment.inReplyToId ?? null,
        pullRequestReviewId: comment.pullRequestReviewId ?? null,
        threadId,
        threadResolved,
        threadCollapsed,
        authorLogin: comment.authorLogin ?? "unknown",
        authorAvatarUrl: comment.authorAvatarUrl ?? null,
        body: comment.body ?? null,
        path: comment.path ?? null,
        line: comment.line ?? null,
        htmlUrl: comment.htmlUrl ?? null,
        createdAt: comment.createdAt ?? 0,
        updatedAt: comment.updatedAt ?? 0,
      }
    }) ?? [],
  pullRequestReviewThreads:
    pr.pullRequestReviewThreads?.map((thread) => ({
      id: thread.id,
      threadId: thread.threadId ?? "",
      resolved: Boolean(thread.resolved),
      payload: thread.payload ?? null,
      createdAt: thread.createdAt ?? 0,
      updatedAt: thread.updatedAt ?? 0,
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
      createdAt: commit.createdAt ?? 0,
      htmlUrl: commit.htmlUrl ?? null,
    })) ?? [],
  checkRuns:
    pr.checkRuns?.map((check) => ({
      id: check.id,
      name: check.name ?? "Check",
      status: check.status ?? "unknown",
      conclusion: check.conclusion ?? null,
      detailsUrl: check.detailsUrl ?? null,
      htmlUrl: check.htmlUrl ?? null,
      updatedAt: check.updatedAt ?? null,
    })) ?? [],
  checkSuites:
    pr.checkSuites?.map((suite) => ({
      id: suite.id,
      status: suite.status ?? "unknown",
      conclusion: suite.conclusion ?? null,
      appName: suite.appName ?? null,
      headSha: suite.headSha ?? null,
      updatedAt: suite.updatedAt ?? null,
    })) ?? [],
  commitStatuses:
    pr.commitStatuses?.map((status) => ({
      id: status.id,
      context: status.context ?? "Status",
      state: status.state ?? "unknown",
      description: status.description ?? null,
      targetUrl: status.targetUrl ?? null,
      updatedAt: status.updatedAt ?? null,
    })) ?? [],
  workflowRuns:
    pr.workflowRuns?.map((run) => ({
      id: run.id,
      githubId: run.githubId ?? 0,
      name: run.name ?? "Workflow run",
      status: run.status ?? "unknown",
      conclusion: run.conclusion ?? null,
      htmlUrl: run.htmlUrl ?? null,
      runNumber: run.runNumber ?? null,
      runAttempt: run.runAttempt ?? null,
      updatedAt: run.updatedAt ?? null,
    })) ?? [],
  workflowJobs:
    pr.workflowJobs?.map((job) => ({
      id: job.id,
      runId: job.runId ?? null,
      name: job.name ?? "Workflow job",
      status: job.status ?? "unknown",
      conclusion: job.conclusion ?? null,
      htmlUrl: job.htmlUrl ?? null,
      runUrl: job.runUrl ?? null,
      updatedAt: job.updatedAt ?? null,
    })) ?? [],
  pullRequestEvents:
    pr.pullRequestEvents?.map((evt) => ({
      id: evt.id,
      eventType: evt.eventType ?? "",
      actorLogin: evt.actorLogin ?? null,
      actorAvatarUrl: evt.actorAvatarUrl ?? null,
      targetLogin: evt.targetLogin ?? null,
      targetAvatarUrl: evt.targetAvatarUrl ?? null,
      label: evt.label ?? null,
      githubCreatedAt: evt.githubCreatedAt ?? 0,
    })) ?? [],
  pullRequestFiles:
    pr.pullRequestFiles?.map((file) => ({
      id: file.id,
      filename: file.filename,
      previousFilename: file.previousFilename,
      status: file.status ?? "modified",
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    })) ?? [],
})
