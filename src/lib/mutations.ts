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
