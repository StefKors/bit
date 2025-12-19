import { useState, useCallback, type ReactNode } from "react"
import { Link, useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { Breadcrumb } from "./Breadcrumb"
import { RepoHeader } from "./RepoHeader"
import { RepoTabs } from "./RepoTabs"
import styles from "./RepoLayout.module.css"

type TabType = "code" | "pulls" | "issues"

interface RepoLayoutProps {
  activeTab: TabType
  children: ReactNode
}

export function RepoLayout({ activeTab, children }: RepoLayoutProps) {
  const params = useParams<{ owner: string; repo: string }>()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repos] = useQuery(queries.repo(fullName))
  const repo = repos[0]

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch(`/api/github/sync/${owner}/${repoName}`, {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()

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
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className={styles.emptyTitle}>Repository not found</h3>
          <p className={styles.emptyText}>
            This repository hasn't been synced yet.{" "}
            <Link href="/">Go back to overview</Link> and sync your
            repositories.
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

      <RepoTabs repoId={repo.id} fullName={fullName} activeTab={activeTab} />

      <div className={styles.content}>{children}</div>
    </div>
  )
}
