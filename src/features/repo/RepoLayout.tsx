import { useState, useCallback, type ReactNode } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useQuery } from "@rocicorp/zero/react"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoHeader } from "./RepoHeader"
import { RepoTabs } from "./RepoTabs"
import styles from "./RepoLayout.module.css"
import type { GithubRepo, GithubPullRequest } from "@/db/schema"

type TabType = "code" | "pulls" | "issues"

export interface RepoData extends GithubRepo {
  githubPullRequest: readonly GithubPullRequest[]
}

interface RepoLayoutProps {
  activeTab: TabType
  children: ReactNode | ((repo: RepoData) => ReactNode)
}

export function RepoLayout({ activeTab, children }: RepoLayoutProps) {
  const params = useParams({ strict: false }) as { owner?: string; repo?: string }
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo with PRs in one go
  const [repo] = useQuery(queries.repoWithPRs(fullName))

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch(`/api/github/sync/${owner}/${repoName}`, {
        method: "POST",
        credentials: "include",
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }, [owner, repoName])

  if (!repo) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <FileDirectoryIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>Repository not found</h3>
          <p className={styles.emptyText}>
            This repository hasn't been synced yet. <Link to="/">Go back to overview</Link> and sync
            your repositories.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", href: "/" },
          { label: owner, href: `/${owner}` },
          { label: repoName, href: `/${owner}/${repoName}` },
        ]}
      />

      <RepoHeader repo={repo} syncing={syncing} onSync={handleSync} />

      {error && <div className={styles.error}>{error}</div>}

      <RepoTabs prs={repo.githubPullRequest} fullName={fullName} activeTab={activeTab} />

      <div className={styles.content}>
        {typeof children === "function" ? children(repo as RepoData) : children}
      </div>
    </div>
  )
}
