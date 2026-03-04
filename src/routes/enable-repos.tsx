import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { LinkExternalIcon, RepoIcon, CheckIcon } from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { Button } from "@/components/Button"
import type { InstallationRepo } from "@/lib/github-installation-repos"
import styles from "./enable-repos.module.css"

export const Route = createFileRoute("/enable-repos")({
  component: EnableReposPage,
})

function EnableReposPage() {
  const { user } = useAuth()
  const [repos, setRepos] = useState<InstallationRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [enabling, setEnabling] = useState(false)
  const [enableError, setEnableError] = useState<string | null>(null)

  const refreshToken = (user as { refresh_token?: string })?.refresh_token
  const hasToken = Boolean(refreshToken)
  const hasFetched = hasFetchedOnce

  if (!user) return null

  const fetchRepos = async () => {
    if (!refreshToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/github/installation/repos", {
        headers: { Authorization: `Bearer ${refreshToken}` },
      })
      const data = (await res.json()) as { repos?: InstallationRepo[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch repos")
      setRepos(data.repos ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repos")
      setRepos([])
    } finally {
      setLoading(false)
      setHasFetchedOnce(true)
    }
  }

  const toggleRepo = (nodeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === repos.length) setSelected(new Set())
    else setSelected(new Set(repos.map((r) => r.nodeId)))
  }

  const handleEnable = async () => {
    if (!refreshToken || selected.size === 0) return
    setEnabling(true)
    setEnableError(null)
    const toEnable = repos.filter((r) => selected.has(r.nodeId))
    try {
      const res = await fetch("/api/github/repos/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ repos: toEnable }),
      })
      const data = (await res.json()) as { enabled?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to enable repos")
      setSelected(new Set())
      window.location.href = "/"
    } catch (err) {
      setEnableError(err instanceof Error ? err.message : "Failed to enable repos")
    } finally {
      setEnabling(false)
    }
  }

  if (!user.login) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.sectionText}>
            Connect your GitHub account first to enable Bit on repositories.
          </p>
          <Button variant="primary" onClick={() => (window.location.href = "/")}>
            Go to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!hasToken) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.error}>Unable to authenticate. Please sign out and sign back in.</p>
        </div>
      </div>
    )
  }

  if (!hasFetched && !loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Enable Bit on repositories</h1>
          <p className={styles.subtitle}>
            Load your repositories from GitHub to select which ones to enable.
          </p>
          <Button variant="primary" size="large" onClick={() => void fetchRepos()}>
            Load repositories
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Enable Bit on repositories</h1>
        <p className={styles.subtitle}>
          Select one or more repositories to enable Bit. Repos are sorted by recent activity.
        </p>

        {error && <div className={styles.error}>{error}</div>}
        {enableError && <div className={styles.error}>{enableError}</div>}

        {loading ? (
          <div className={styles.loading}>Loading repositories...</div>
        ) : (
          <>
            {repos.length === 0 ? (
              <p className={styles.empty}>
                No repositories found. Install the Bit GitHub App on your account or organizations
                to see repos here.
              </p>
            ) : (
              <>
                <div className={styles.toolbar}>
                  <button type="button" className={styles.selectAll} onClick={toggleAll}>
                    {selected.size === repos.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className={styles.count}>
                    {selected.size} of {repos.length} selected
                  </span>
                </div>
                <div className={styles.grid}>
                  {repos.map((repo) => (
                    <RepoCard
                      key={repo.nodeId}
                      repo={repo}
                      selected={selected.has(repo.nodeId)}
                      onToggle={() => {
                        toggleRepo(repo.nodeId)
                      }}
                    />
                  ))}
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    size="large"
                    disabled={selected.size === 0 || enabling}
                    loading={enabling}
                    onClick={() => void handleEnable()}
                  >
                    Enable Bit on {selected.size} repo{selected.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.refresh}
            onClick={() => void fetchRepos()}
            disabled={loading}
          >
            Refresh list
          </button>
        </div>
      </div>
    </div>
  )
}

const RepoCard = ({
  repo,
  selected,
  onToggle,
}: {
  repo: InstallationRepo
  selected: boolean
  onToggle: () => void
}) => (
  <button
    type="button"
    className={`${styles.repoCard} ${selected ? styles.selected : ""}`}
    onClick={onToggle}
  >
    <span className={styles.check}>{selected ? <CheckIcon size={16} /> : null}</span>
    <RepoIcon size={20} className={styles.repoIcon} />
    <div className={styles.repoInfo}>
      <span className={styles.repoName}>{repo.fullName}</span>
      {repo.description && <p className={styles.repoDesc}>{repo.description}</p>}
      <div className={styles.repoMeta}>
        {repo.language && <span className={styles.meta}>{repo.language}</span>}
        <span className={styles.meta}>★ {repo.stargazersCount}</span>
        <span className={styles.meta}>Fork {repo.forksCount}</span>
      </div>
    </div>
    <a
      href={repo.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.external}
      onClick={(e) => {
        e.stopPropagation()
      }}
      aria-label={`Open ${repo.fullName} on GitHub`}
    >
      <LinkExternalIcon size={14} />
    </a>
  </button>
)
