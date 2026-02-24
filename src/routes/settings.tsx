import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useRef } from "react"
import {
  MarkGithubIcon,
  CheckCircleFillIcon,
  AlertIcon,
  TrashIcon,
  SyncIcon,
  LinkExternalIcon,
  PlusIcon,
  RepoIcon,
} from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from "@/lib/instantDb"
import { getPRLayoutMode, setPRLayoutMode, type PRLayoutMode } from "@/lib/pr-layout-preference"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import styles from "@/pages/SettingsPage.module.css"

function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [prLayoutMode, setPrLayoutMode] = useState<PRLayoutMode>(() => getPRLayoutMode())

  const isGitHubConnected = Boolean(user?.login)
  const isFullScreenPRLayout = prLayoutMode === "full-screen-3-column"

  const { data: syncData } = db.useQuery({ syncStates: {} })
  const syncStates = syncData?.syncStates ?? []

  const tokenState = syncStates.find((s) => s.resourceType === "github:token")
  const isAuthInvalid = tokenState?.syncStatus === "auth_invalid"

  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const lastSyncedAt = initialSyncState?.lastSyncedAt

  const handleConnectGitHub = () => {
    if (!user?.id) return
    setError(null)
    setSuccess(null)

    const connectUrl = `/api/github/oauth?${new URLSearchParams({ userId: user.id }).toString()}`
    if (!isGitHubConnected) {
      window.location.href = connectUrl
      return
    }

    void (async () => {
      try {
        const response = await fetch("/api/github/oauth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.id}`,
          },
          body: JSON.stringify({ userId: user.id }),
        })

        if (!response.ok) {
          let errorMessage = "Failed to prepare GitHub reconnect"
          try {
            const payload = (await response.json()) as { error?: string }
            errorMessage = payload.error || errorMessage
          } catch {
            errorMessage = `Reconnect request failed (${response.status})`
          }
          throw new Error(errorMessage)
        }

        window.location.href = connectUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to prepare GitHub reconnect")
      }
    })()
  }

  const handleDisconnect = async () => {
    if (!user?.id) return
    setDisconnecting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/github/sync/reset", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.id}` },
      })

      if (!response.ok) {
        let errorMessage = "Failed to disconnect"
        try {
          const text = await response.text()
          const data = text ? (JSON.parse(text) as { error?: string }) : null
          errorMessage = data?.error ?? errorMessage
        } catch {
          errorMessage = `Request failed (${response.status})`
        }
        throw new Error(errorMessage)
      }

      setSuccess("GitHub account disconnected. Redirecting...")
      setTimeout(() => {
        void navigate({
          to: "/",
          search: { github: undefined, error: undefined, message: undefined },
        })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }

  const handlePRLayoutToggle = () => {
    const nextMode: PRLayoutMode = isFullScreenPRLayout ? "default" : "full-screen-3-column"
    setPrLayoutMode(nextMode)
    setPRLayoutMode(nextMode)
  }

  if (!user) return null

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Settings</h1>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {success && <div className={styles.successBanner}>{success}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>GitHub Connection</h2>

        {isGitHubConnected ? (
          <div className={styles.card}>
            <div className={styles.connectionHeader}>
              <div className={styles.connectionInfo}>
                <Avatar src={user.avatarUrl} name={user.name || user.login} size={48} />
                <div className={styles.connectionDetails}>
                  <span className={styles.connectionName}>{user.name || user.login}</span>
                  <span className={styles.connectionLogin}>@{user.login}</span>
                </div>
              </div>

              {isAuthInvalid ? (
                <div className={styles.statusBadgeDanger}>
                  <AlertIcon size={14} />
                  Expired
                </div>
              ) : (
                <div className={styles.statusBadgeSuccess}>
                  <CheckCircleFillIcon size={14} />
                  Connected
                </div>
              )}
            </div>

            {isAuthInvalid && (
              <div className={styles.warningBanner}>
                <AlertIcon size={16} />
                <div>
                  <strong>Connection expired</strong>
                  <p>
                    Your GitHub token is no longer valid. Reconnect to resume syncing repositories
                    and pull requests.
                  </p>
                </div>
              </div>
            )}

            {Boolean(lastSyncedAt) && !isAuthInvalid && (
              <div className={styles.metaRow}>
                <SyncIcon size={14} />
                Last synced {formatTimeAgo(lastSyncedAt!)}
              </div>
            )}

            {user.htmlUrl && (
              <div className={styles.metaRow}>
                <LinkExternalIcon size={14} />
                <a
                  href={user.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  {user.htmlUrl}
                </a>
              </div>
            )}

            <div className={styles.cardActions}>
              <Button
                variant={isAuthInvalid ? "primary" : "default"}
                leadingIcon={<MarkGithubIcon size={16} />}
                onClick={handleConnectGitHub}
              >
                {isAuthInvalid ? "Reconnect GitHub" : "Reconnect"}
              </Button>
              <Button
                variant="danger"
                leadingIcon={<TrashIcon size={16} />}
                loading={disconnecting}
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </Button>
            </div>

            <div className={styles.permissionsHint}>
              <AlertIcon size={14} />
              <p>
                Organization access can still depend on GitHub org policies. If repos or webhooks
                are missing after reconnecting, ask an org admin to approve this OAuth app and
                authorize the token for org SAML SSO.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={styles.emptyConnection}>
              <MarkGithubIcon size={40} className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>No GitHub account connected</h3>
              <p className={styles.emptyDescription}>
                Connect your GitHub account to sync repositories, pull requests, and receive
                real-time updates.
              </p>
              <Button
                variant="primary"
                size="large"
                leadingIcon={<MarkGithubIcon size={20} />}
                onClick={handleConnectGitHub}
              >
                Connect GitHub
              </Button>
            </div>
          </div>
        )}
      </section>

      {isGitHubConnected && !isAuthInvalid && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Add Repository</h2>
          <AddRepoCard userId={user.id} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pull Request View</h2>
        <div className={styles.card}>
          <div className={styles.preferenceRow}>
            <div className={styles.preferenceInfo}>
              <span className={styles.preferenceLabel}>Enable full-screen PR workspace</span>
              <p className={styles.preferenceDescription}>
                Shows pull requests in a 3-column layout with PR list, diffs, and activity.
              </p>
            </div>
            <button
              type="button"
              className={`${styles.toggleSwitch} ${isFullScreenPRLayout ? styles.toggleSwitchOn : ""}`}
              aria-label="Enable full-screen PR workspace"
              aria-pressed={isFullScreenPRLayout}
              onClick={handlePRLayoutToggle}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
          <p className={styles.preferenceHint}>
            This applies to repository pull request detail pages.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.card}>
          <div className={styles.accountRow}>
            <div>
              <span className={styles.accountLabel}>Email</span>
              <span className={styles.accountValue}>{user.email}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function AddRepoCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)

  const handleAddRepo = async () => {
    const url = inputRef.current?.value?.trim()
    if (!url) return

    setAdding(true)
    setAddError(null)
    setAddSuccess(null)

    try {
      const response = await fetch("/api/github/sync/add-repo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({ url }),
      })

      const data = (await response.json()) as {
        error?: string
        details?: string
        owner?: string
        repo?: string
        pullRequests?: number
        webhookStatus?: string
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to add repository")
      }

      if (inputRef.current) inputRef.current.value = ""
      setAddSuccess(`Added ${data.owner}/${data.repo} (${data.pullRequests} open PRs)`)

      setTimeout(() => {
        void navigate({
          to: "/$owner/$repo",
          params: { owner: data.owner!, repo: data.repo! },
        })
      }, 1200)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add repository")
    } finally {
      setAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleAddRepo()
  }

  return (
    <div className={styles.card}>
      <div className={styles.addRepoRow}>
        <RepoIcon size={16} className={styles.addRepoIcon} />
        <input
          ref={inputRef}
          type="text"
          className={styles.addRepoInput}
          placeholder="https://github.com/owner/repo or owner/repo"
          onKeyDown={handleKeyDown}
          disabled={adding}
        />
        <Button
          variant="primary"
          size="small"
          leadingIcon={<PlusIcon size={16} />}
          loading={adding}
          onClick={() => void handleAddRepo()}
        >
          Add
        </Button>
      </div>
      {addError && <div className={styles.addRepoError}>{addError}</div>}
      {addSuccess && <div className={styles.addRepoSuccess}>{addSuccess}</div>}
      <p className={styles.addRepoHint}>
        Paste a GitHub URL or type owner/repo to track a specific repository.
      </p>
    </div>
  )
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})
