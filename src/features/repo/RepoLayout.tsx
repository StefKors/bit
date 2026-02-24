import { type ReactNode } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncRepoMutation } from "@/lib/mutations"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoHeader } from "./RepoHeader"
import { RepoTabs } from "./RepoTabs"
import styles from "./RepoLayout.module.css"

type TabType = "code" | "pulls" | "issues" | "commits"

// Define types for InstantDB data
interface Organization {
  id: string
  login: string
  name?: string | null
  description?: string | null
  avatarUrl?: string | null
}

interface PullRequest {
  id: string
  number: number
  title: string
  state: string
  draft: boolean
  merged: boolean
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
}

interface Issue {
  id: string
  number: number
  title: string
  state: string
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
}

export interface RepoData {
  id: string
  name: string
  fullName: string
  owner: string
  description?: string | null
  htmlUrl?: string | null
  stargazersCount?: number | null
  forksCount?: number | null
  defaultBranch?: string | null
  organization?: Organization | null
  pullRequests: readonly PullRequest[]
  issues: readonly Issue[]
  webhookStatus?: string | null
  webhookError?: string | null
  syncedAt?: number | null
}

interface RepoLayoutProps {
  activeTab: TabType
  children: ReactNode | ((repo: RepoData) => ReactNode)
}

export function RepoLayout({ activeTab, children }: RepoLayoutProps) {
  const { user } = useAuth()
  const params = useParams({ strict: false })

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  const repoSync = useMutation(syncRepoMutation(user?.id ?? "", owner, repoName))

  const { data: reposData, isLoading } = db.useQuery({
    repos: {
      $: { where: { fullName } },
      organization: {},
      pullRequests: {},
      issues: {},
    },
  })

  const repoRaw = reposData?.repos?.[0] ?? null
  const syncing = repoSync.isPending
  const error = repoSync.error?.message ?? null

  if (isLoading) {
    return <div className={styles.container} />
  }

  if (!repoRaw) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <FileDirectoryIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Repository not found</h3>
          <p className={styles.emptyText}>
            This repository hasn't been synced yet.{" "}
            <Link
              to="/"
              search={{
                github: undefined,
                error: undefined,
                message: undefined,
                revokeUrl: undefined,
              }}
            >
              Go back to overview
            </Link>{" "}
            and sync your repositories.
          </p>
        </div>
      </div>
    )
  }

  // Transform to expected shape
  const repo: RepoData = {
    id: repoRaw.id,
    name: repoRaw.name,
    fullName: repoRaw.fullName,
    owner: repoRaw.owner,
    description: repoRaw.description,
    htmlUrl: repoRaw.htmlUrl,
    stargazersCount: repoRaw.stargazersCount,
    forksCount: repoRaw.forksCount,
    defaultBranch: repoRaw.defaultBranch,
    organization: repoRaw.organization ?? null,
    pullRequests: repoRaw.pullRequests ?? [],
    issues: repoRaw.issues ?? [],
    webhookStatus: repoRaw.webhookStatus,
    webhookError: repoRaw.webhookError,
    syncedAt: repoRaw.syncedAt,
  }

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", to: "/" },
          { label: owner, to: "/$owner", params: { owner } },
          { label: repoName, to: "/$owner/$repo", params: { owner, repo: repoName } },
        ]}
      />

      <RepoHeader repo={repo} syncing={syncing} onSync={() => repoSync.mutate()} />

      {error && <div className={styles.error}>{error}</div>}

      <RepoTabs
        prs={repo.pullRequests as Parameters<typeof RepoTabs>[0]["prs"]}
        issues={repo.issues as Parameters<typeof RepoTabs>[0]["issues"]}
        fullName={fullName}
        activeTab={activeTab}
        defaultBranch={repo.defaultBranch ?? undefined}
      />

      <div className={styles.content}>
        {typeof children === "function" ? children(repo) : children}
      </div>
    </div>
  )
}
