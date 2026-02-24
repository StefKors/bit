import { mutationOptions } from "@tanstack/react-query"

type SyncResponse = { error?: string; code?: string }

const postSync = async (
  url: string,
  userId: string,
  body?: Record<string, string | undefined>,
): Promise<SyncResponse> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${userId}`,
  }
  const init: RequestInit = {
    method: "POST",
    credentials: "include",
    headers,
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)
  const data = (await res.json()) as SyncResponse
  if (!res.ok) {
    if (data.code === "auth_invalid") {
      throw new Error("Your GitHub connection has expired. Please reconnect to continue syncing.")
    }
    throw new Error(data.error || "Request failed")
  }
  return data
}

export type OverviewSyncResponse = SyncResponse & {
  rateLimit?: { remaining: number; limit: number; reset: string }
}

export const syncOverviewMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["sync", "overview"],
    mutationFn: async (): Promise<OverviewSyncResponse> => {
      const res = await fetch("/api/github/sync/overview", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${userId}` },
      })
      const data = (await res.json()) as OverviewSyncResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error(
            "Your GitHub connection has expired. Please reconnect to continue syncing.",
          )
        }
        throw new Error(data.error || "Failed to sync")
      }
      return data
    },
  })

export const syncRepoMutation = (userId: string, owner: string, repo: string) =>
  mutationOptions({
    mutationKey: ["sync", "repo", owner, repo],
    mutationFn: () => postSync(`/api/github/sync/${owner}/${repo}`, userId),
  })

export const syncPrMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
  force = false,
) =>
  mutationOptions({
    mutationKey: ["sync", "pr", owner, repo, number],
    mutationFn: () =>
      postSync(
        `/api/github/sync/${owner}/${repo}/pull/${number}${force ? "?force=true" : ""}`,
        userId,
      ),
  })

export const syncIssueMutation = (userId: string, owner: string, repo: string, number: number) =>
  mutationOptions({
    mutationKey: ["sync", "issue", owner, repo, number],
    mutationFn: () => postSync(`/api/github/sync/${owner}/${repo}/issue/${number}`, userId),
  })

export const syncTreeMutation = (userId: string, owner: string, repo: string, ref: string) =>
  mutationOptions({
    mutationKey: ["sync", "tree", owner, repo],
    mutationFn: () => postSync(`/api/github/sync/${owner}/${repo}/tree?ref=${ref}`, userId),
  })

export const syncCommitsMutation = (userId: string, owner: string, repo: string, ref: string) =>
  mutationOptions({
    mutationKey: ["sync", "commits", owner, repo],
    mutationFn: () => postSync(`/api/github/sync/${owner}/${repo}/commits?ref=${ref}`, userId),
  })

export const syncResetMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["sync", "reset"],
    mutationFn: (vars: { resourceType: string; resourceId?: string }) =>
      postSync("/api/github/sync/reset", userId, vars),
  })

export const syncRetryMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["sync", "retry"],
    mutationFn: (vars: { resourceType: string; resourceId?: string }) =>
      postSync("/api/github/sync/retry", userId, vars),
  })

export const syncWebhooksMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["sync", "webhooks"],
    mutationFn: () => postSync("/api/github/sync/webhooks", userId),
  })

export type AddRepoResponse = SyncResponse & {
  details?: string
  owner?: string
  repo?: string
  pullRequests?: number
  webhookStatus?: string
}

export const syncAddRepoMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["sync", "add-repo"],
    mutationFn: async (vars: { url: string }): Promise<AddRepoResponse> => {
      const res = await fetch("/api/github/sync/add-repo", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as AddRepoResponse
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to add repository")
      }
      return data
    },
  })

export const disconnectGitHubMutation = (userId: string) =>
  mutationOptions({
    mutationKey: ["github", "disconnect"],
    mutationFn: async () => {
      const res = await fetch("/api/github/sync/reset", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userId}` },
      })
      if (!res.ok) {
        let errorMessage = "Failed to disconnect"
        try {
          const text = await res.text()
          const data = text ? (JSON.parse(text) as { error?: string }) : null
          errorMessage = data?.error ?? errorMessage
        } catch {
          errorMessage = `Request failed (${res.status})`
        }
        throw new Error(errorMessage)
      }
    },
  })

export interface MergePRResponse {
  merged: boolean
  message: string
  sha?: string
  error?: string
  code?: string
}

export const mergePRMutation = (userId: string, owner: string, repo: string, number: number) =>
  mutationOptions({
    mutationKey: ["pr", "merge", owner, repo, number],
    mutationFn: async (options: {
      commitTitle?: string
      commitMessage?: string
      sha?: string
      mergeMethod?: "merge" | "squash" | "rebase"
    }): Promise<MergePRResponse> => {
      const res = await fetch(`/api/github/pr/merge/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(options),
      })
      const data = (await res.json()) as MergePRResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        if (data.code === "merge_conflict") {
          throw new Error("This pull request has merge conflicts that must be resolved.")
        }
        throw new Error(data.error || "Failed to merge pull request")
      }
      return data
    },
  })

export interface UpdatePRStateResponse {
  number: number
  state: "open" | "closed"
  merged: boolean
  error?: string
  code?: string
}

export const updatePRStateMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "state", owner, repo, number],
    mutationFn: async (state: "open" | "closed"): Promise<UpdatePRStateResponse> => {
      const res = await fetch(`/api/github/pr/state/${owner}/${repo}/${number}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ state }),
      })
      const data = (await res.json()) as UpdatePRStateResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to update pull request state")
      }
      return data
    },
  })

export interface UpdatePRResponse {
  number: number
  title: string
  body: string | null
  state: "open" | "closed"
  draft: boolean
  githubUpdatedAt: number | null
  error?: string
  code?: string
}

export const updatePRMutation = (userId: string, owner: string, repo: string, number: number) =>
  mutationOptions({
    mutationKey: ["pr", "update", owner, repo, number],
    mutationFn: async (vars: { title?: string; body?: string }): Promise<UpdatePRResponse> => {
      const res = await fetch(`/api/github/pr/update/${owner}/${repo}/${number}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as UpdatePRResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to update pull request")
      }
      return data
    },
  })

type DeleteBranchResponse = {
  deleted: boolean
  error?: string
  code?: string
}

type RestoreBranchResponse = {
  restored: boolean
  ref: string
  sha: string
  error?: string
  code?: string
}

export const deleteBranchMutation = (userId: string, owner: string, repo: string) =>
  mutationOptions({
    mutationKey: ["branch", "delete", owner, repo],
    mutationFn: async (vars: { branch: string }): Promise<DeleteBranchResponse> => {
      const res = await fetch(`/api/github/branch/${owner}/${repo}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as DeleteBranchResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to delete branch")
      }
      return data
    },
  })

export const restoreBranchMutation = (userId: string, owner: string, repo: string) =>
  mutationOptions({
    mutationKey: ["branch", "restore", owner, repo],
    mutationFn: async (vars: { branch: string; sha: string }): Promise<RestoreBranchResponse> => {
      const res = await fetch(`/api/github/branch/${owner}/${repo}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as RestoreBranchResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to restore branch")
      }
      return data
    },
  })

type CommentResponse = {
  id: number
  body: string
  htmlUrl: string | null
  error?: string
  code?: string
}

type DeleteCommentResponse = {
  deleted: boolean
  error?: string
  code?: string
}

export const createCommentMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "comments", "create", owner, repo, number],
    mutationFn: async (vars: { body: string }): Promise<CommentResponse> => {
      const res = await fetch(`/api/github/comments/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as CommentResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to create comment")
      }
      return data
    },
  })

export const updateCommentMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "comments", "update", owner, repo, number],
    mutationFn: async (vars: { commentId: number; body: string }): Promise<CommentResponse> => {
      const res = await fetch(`/api/github/comments/${owner}/${repo}/${number}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as CommentResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to update comment")
      }
      return data
    },
  })

export const deleteCommentMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "comments", "delete", owner, repo, number],
    mutationFn: async (vars: { commentId: number }): Promise<DeleteCommentResponse> => {
      const res = await fetch(`/api/github/comments/${owner}/${repo}/${number}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as DeleteCommentResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to delete comment")
      }
      return data
    },
  })

type SubmitReviewResponse = {
  id: number
  state: string
  body: string | null
  htmlUrl: string | null
  error?: string
  code?: string
}

export const submitReviewMutation = (userId: string, owner: string, repo: string, number: number) =>
  mutationOptions({
    mutationKey: ["pr", "reviews", "submit", owner, repo, number],
    mutationFn: async (vars: {
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
      body?: string
    }): Promise<SubmitReviewResponse> => {
      const res = await fetch(`/api/github/reviews/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as SubmitReviewResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to submit review")
      }
      return data
    },
  })

export const createDraftReviewMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "reviews", "create-draft", owner, repo, number],
    mutationFn: async (vars: { body?: string }): Promise<SubmitReviewResponse> => {
      const res = await fetch(`/api/github/reviews/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          action: "create_draft",
          body: vars.body,
        }),
      })
      const data = (await res.json()) as SubmitReviewResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to create draft review")
      }
      return data
    },
  })

export const submitDraftReviewMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "reviews", "submit-draft", owner, repo, number],
    mutationFn: async (vars: {
      reviewId: number
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
      body?: string
    }): Promise<SubmitReviewResponse> => {
      const res = await fetch(`/api/github/reviews/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          action: "submit_draft",
          reviewId: vars.reviewId,
          event: vars.event,
          body: vars.body,
        }),
      })
      const data = (await res.json()) as SubmitReviewResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to submit draft review")
      }
      return data
    },
  })

type DiscardDraftReviewResponse = {
  discarded: boolean
  error?: string
  code?: string
}

export const discardDraftReviewMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "reviews", "discard-draft", owner, repo, number],
    mutationFn: async (vars: { reviewId: number }): Promise<DiscardDraftReviewResponse> => {
      const res = await fetch(`/api/github/reviews/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          action: "discard_draft",
          reviewId: vars.reviewId,
        }),
      })
      const data = (await res.json()) as DiscardDraftReviewResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to discard draft review")
      }
      return data
    },
  })

type ReRequestReviewResponse = {
  requestedReviewers: string[]
  requestedTeams: string[]
  error?: string
  code?: string
}

export const reRequestReviewMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "reviews", "re-request", owner, repo, number],
    mutationFn: async (vars: {
      reviewers: string[]
      teamReviewers?: string[]
    }): Promise<ReRequestReviewResponse> => {
      const res = await fetch(`/api/github/reviews/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          action: "re_request",
          reviewers: vars.reviewers,
          teamReviewers: vars.teamReviewers,
        }),
      })
      const data = (await res.json()) as ReRequestReviewResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to re-request review")
      }
      return data
    },
  })

type ToggleFileViewedResponse = {
  viewedFiles: string[]
  path: string
  viewed: boolean
  error?: string
  code?: string
}

export const toggleFileViewedMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "files", "viewed", owner, repo, number],
    mutationFn: async (vars: {
      path: string
      viewed: boolean
    }): Promise<ToggleFileViewedResponse> => {
      const res = await fetch(`/api/github/viewed/${owner}/${repo}/${number}`, {
        method: vars.viewed ? "POST" : "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ path: vars.path }),
      })
      const data = (await res.json()) as ToggleFileViewedResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to update viewed file state")
      }
      return data
    },
  })

type ReviewCommentResponse = {
  id: number
  body: string
  htmlUrl: string | null
  path: string | null
  line: number | null
  side: "LEFT" | "RIGHT" | null
  error?: string
  code?: string
}

export const createReviewCommentMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "review-comments", "create", owner, repo, number],
    mutationFn: async (vars: {
      body: string
      path?: string
      line?: number
      side?: "LEFT" | "RIGHT"
      commitId?: string
      inReplyTo?: number
    }): Promise<ReviewCommentResponse> => {
      const res = await fetch(`/api/github/review-comments/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as ReviewCommentResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to create inline review comment")
      }
      return data
    },
  })

export const createSuggestionMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "suggestions", "create", owner, repo, number],
    mutationFn: async (vars: {
      body?: string
      suggestion: string
      path: string
      line: number
      side: "LEFT" | "RIGHT"
      commitId: string
    }): Promise<ReviewCommentResponse> => {
      const res = await fetch(`/api/github/suggestions/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as ReviewCommentResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to create suggested change")
      }
      return data
    },
  })

type ResolveThreadResponse = {
  commentId: number
  resolved: boolean
  error?: string
  code?: string
}

export const resolveThreadMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "threads", "resolve", owner, repo, number],
    mutationFn: async (vars: { commentId: number }): Promise<ResolveThreadResponse> => {
      const res = await fetch(`/api/github/resolve/${owner}/${repo}/${number}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as ResolveThreadResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to resolve thread")
      }
      return data
    },
  })

export const unresolveThreadMutation = (
  userId: string,
  owner: string,
  repo: string,
  number: number,
) =>
  mutationOptions({
    mutationKey: ["pr", "threads", "unresolve", owner, repo, number],
    mutationFn: async (vars: { commentId: number }): Promise<ResolveThreadResponse> => {
      const res = await fetch(`/api/github/resolve/${owner}/${repo}/${number}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(vars),
      })
      const data = (await res.json()) as ResolveThreadResponse
      if (!res.ok) {
        if (data.code === "auth_invalid") {
          throw new Error("Your GitHub connection has expired. Please reconnect to continue.")
        }
        throw new Error(data.error || "Failed to unresolve thread")
      }
      return data
    },
  })
