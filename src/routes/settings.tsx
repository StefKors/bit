import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { id } from "@instantdb/react"
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
import {
  disconnectGitHubMutation,
  syncAddRepoMutation,
  syncOverviewMutation,
  syncResetMutation,
  syncRetryMutation,
  type AddRepoResponse,
} from "@/lib/mutations"
import { getPRLayoutMode, setPRLayoutMode, type PRLayoutMode } from "@/lib/pr-layout-preference"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import { SyncManagement } from "@/components/SyncManagement"
import { WebhookManagement } from "@/features/overview"
import styles from "@/pages/SettingsPage.module.css"

type WebhookSyncMode = "minimal" | "full" | "full-force"

const SYNC_MODE_OPTIONS: { value: WebhookSyncMode; label: string; description: string }[] = [
  {
    value: "minimal",
    label: "Minimal",
    description:
      "Webhook payload only. Fastest, uses no extra API calls. Detail data is only fetched when you open a PR page.",
  },
  {
    value: "full",
    label: "Full",
    description:
      "Webhook payload + fetch related PR details (files, reviews, comments, commits). Respects freshness cache.",
  },
  {
    value: "full-force",
    label: "Full (force)",
    description:
      "Webhook payload + force-fetch all related PR details, bypassing freshness cache. Most thorough, highest API usage.",
  },
]

const GITHUB_APP_SLUG = "bit-backend"
const GITHUB_APP_INSTALLATIONS_URL = "https://github.com/settings/installations"

function SettingsPage() {
  const { user } = useAuth()
  const [prLayoutMode, setPrLayoutMode] = useState<PRLayoutMode>(() => getPRLayoutMode())

  const disconnect = useMutation({
    ...disconnectGitHubMutation(user?.id ?? ""),
    onSuccess: () => {
      setSuccess("GitHub account disconnected.")
    },
  })
  const disconnecting = disconnect.isPending
  const [success, setSuccess] = useState<string | null>(null)
  const error = disconnect.error?.message ?? null

  const { data } = db.useQuery({
    syncStates: {},
    userSettings: {},
    repos: { $: { limit: 500 } },
  })
  const syncStates = data?.syncStates ?? []
  const repos = data?.repos ?? []
  const userSettingsRecord = data?.userSettings?.[0] ?? null

  const overviewSync = useMutation(syncOverviewMutation(user?.id ?? ""))
  const resetSync = useMutation(syncResetMutation(user?.id ?? ""))
  const retrySync = useMutation(syncRetryMutation(user?.id ?? ""))
  const currentSyncMode: WebhookSyncMode =
    (userSettingsRecord?.webhookPrSyncBehavior as WebhookSyncMode) || "full"

  const tokenState = syncStates.find((s) => s.resourceType === "github:token")
  const isGitHubConnected = Boolean(tokenState)
  const isAuthInvalid = tokenState?.syncStatus === "auth_invalid"

  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const lastSyncedAt = initialSyncState?.lastSyncedAt

  const isFullScreenPRLayout = prLayoutMode === "full-screen-3-column"
  const githubAppInstallUrl = user?.id
    ? `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?${new URLSearchParams({ state: user.id }).toString()}`
    : `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`

  const handleConnectGitHub = () => {
    if (!user?.id) return
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
      } catch {
        // navigation will happen on success; errors are non-critical
      }
    })()
  }

  const handlePRLayoutToggle = () => {
    const nextMode: PRLayoutMode = isFullScreenPRLayout ? "default" : "full-screen-3-column"
    setPrLayoutMode(nextMode)
    setPRLayoutMode(nextMode)
  }

  const handleInstallGitHubApp = () => {
    window.location.href = githubAppInstallUrl
  }

  const handleManageGitHubApp = () => {
    window.location.href = GITHUB_APP_INSTALLATIONS_URL
  }

  const handleRemoveGitHubApp = () => {
    window.location.href = GITHUB_APP_INSTALLATIONS_URL
  }

  const handleSyncModeChange = (mode: WebhookSyncMode) => {
    if (!user?.id) return
    const now = Date.now()
    const settingsId = userSettingsRecord?.id || id()
    void db.transact(
      db.tx.userSettings[settingsId]
        .update({
          webhookPrSyncBehavior: mode,
          userId: user.id,
          createdAt: userSettingsRecord?.createdAt ?? now,
          updatedAt: now,
        })
        .link({ user: user.id }),
    )
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
                onClick={() => {
                  disconnect.mutate()
                }}
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

            <div className={styles.appActions}>
              <Button variant="default" onClick={handleInstallGitHubApp}>
                Install GitHub App
              </Button>
              <Button variant="default" onClick={handleManageGitHubApp}>
                Manage GitHub App
              </Button>
              <Button variant="danger" onClick={handleRemoveGitHubApp}>
                Remove GitHub App
              </Button>
            </div>
            <p className={styles.appActionsHint}>
              Manage and remove open GitHub installations. Use Install if you need to grant access
              to additional orgs or repositories.
            </p>
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
              <div className={styles.appActions}>
                <Button variant="default" onClick={handleInstallGitHubApp}>
                  Install GitHub App
                </Button>
                <Button variant="default" onClick={handleManageGitHubApp}>
                  Manage GitHub App
                </Button>
              </div>
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
        <h2 className={styles.sectionTitle}>Webhook Sync Behavior</h2>
        <div className={styles.card}>
          <div className={styles.preferenceInfo}>
            <span className={styles.preferenceLabel}>PR detail sync mode</span>
            <p className={styles.preferenceDescription}>
              Controls how much data is fetched when GitHub webhook events arrive for pull requests.
            </p>
          </div>
          <div className={styles.radioGroup}>
            {SYNC_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`${styles.radioOption} ${currentSyncMode === option.value ? styles.radioOptionSelected : ""}`}
              >
                <input
                  type="radio"
                  name="webhookSyncMode"
                  className={styles.radioInput}
                  value={option.value}
                  checked={currentSyncMode === option.value}
                  onChange={() => {
                    handleSyncModeChange(option.value)
                  }}
                />
                <div className={styles.radioContent}>
                  <span className={styles.radioLabel}>{option.label}</span>
                  <p className={styles.radioDescription}>{option.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className={styles.preferenceHint}>
            Changes take effect immediately for incoming webhooks.
          </p>
        </div>
      </section>

      {isGitHubConnected && !isAuthInvalid && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Webhook Queue</h2>
          <WebhookQueueCard />
        </section>
      )}

      {isGitHubConnected && !isAuthInvalid && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sync Debug</h2>
          <div className={styles.card}>
            <div className={styles.preferenceRow}>
              <div className={styles.preferenceInfo}>
                <span className={styles.preferenceLabel}>Sync Overview</span>
                <p className={styles.preferenceDescription}>
                  Manually trigger a full overview sync (repos, orgs, PRs). Use for debugging.
                </p>
              </div>
              <Button
                variant="default"
                size="small"
                leadingIcon={<SyncIcon size={14} />}
                loading={overviewSync.isPending}
                onClick={() => {
                  overviewSync.mutate()
                }}
              >
                Sync Overview
              </Button>
            </div>
          </div>
          <SyncManagement
            syncStates={syncStates}
            onResetSync={(type, resId) => {
              resetSync.mutate({ resourceType: type, resourceId: resId })
            }}
            onRetrySync={(type, resId) => {
              retrySync.mutate({ resourceType: type, resourceId: resId })
            }}
          />
          {user?.id && (
            <div style={{ marginTop: "1rem" }}>
              <WebhookManagement repos={repos} userId={user.id} />
            </div>
          )}
        </section>
      )}

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

  const addRepo = useMutation({
    ...syncAddRepoMutation(userId),
    onSuccess: (data: AddRepoResponse) => {
      if (inputRef.current) inputRef.current.value = ""
      setTimeout(() => {
        void navigate({
          to: "/$owner/$repo",
          params: { owner: data.owner!, repo: data.repo! },
        })
      }, 1200)
    },
  })
  const adding = addRepo.isPending
  const addError = addRepo.error?.message ?? null
  const addSuccess = addRepo.data
    ? `Added ${addRepo.data.owner}/${addRepo.data.repo} (${addRepo.data.pullRequests} open PRs)`
    : null

  const handleAddRepo = () => {
    const url = inputRef.current?.value?.trim()
    if (!url) return
    addRepo.mutate({ url })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddRepo()
    }
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
          onClick={() => {
            handleAddRepo()
          }}
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

type QueueItem = {
  id: string
  deliveryId: string
  event: string
  action?: string
  status: string
  attempts: number
  maxAttempts: number
  lastError?: string
  createdAt: number
  failedAt?: number
}

function WebhookQueueCard() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)

  const loadItems = async () => {
    setLoading(true)
    setQueueError(null)
    try {
      const res = await fetch("/api/github/webhook-queue")
      const data = (await res.json()) as { items?: QueueItem[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load queue")
      setItems(data.items ?? [])
      setLoaded(true)
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string, itemId?: string) => {
    try {
      const res = await fetch("/api/github/webhook-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || "Action failed")
      }
      await loadItems()
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Action failed")
    }
  }

  const deadLetterItems = items.filter((i) => i.status === "dead_letter")
  const failedItems = items.filter((i) => i.status === "failed")

  return (
    <div className={styles.card}>
      <div className={styles.preferenceRow}>
        <div className={styles.preferenceInfo}>
          <span className={styles.preferenceLabel}>Dead-letter & failed webhooks</span>
          <p className={styles.preferenceDescription}>
            Inspect webhooks that exhausted retries or are currently failing.
          </p>
        </div>
        <Button variant="default" size="small" loading={loading} onClick={() => void loadItems()}>
          {loaded ? "Refresh" : "Load"}
        </Button>
      </div>

      {queueError && <div className={styles.errorBanner}>{queueError}</div>}

      {loaded && items.length === 0 && (
        <p className={styles.preferenceHint}>No dead-letter or failed items in the queue.</p>
      )}

      {loaded && items.length > 0 && (
        <>
          {deadLetterItems.length > 0 && (
            <div className={styles.cardActions}>
              <Button
                variant="default"
                size="small"
                leadingIcon={<SyncIcon size={14} />}
                onClick={() => void handleAction("retry-all")}
              >
                Retry all dead-letter ({deadLetterItems.length})
              </Button>
              <Button
                variant="danger"
                size="small"
                leadingIcon={<TrashIcon size={14} />}
                onClick={() => void handleAction("discard-all")}
              >
                Discard all
              </Button>
            </div>
          )}

          <div className={styles.accountRow} style={{ flexDirection: "column", gap: "0.5rem" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid rgba(var(--bit-rgb-fg), 0.06)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color:
                          item.status === "dead_letter"
                            ? "var(--bit-color-danger)"
                            : "var(--bit-color-warning)",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.status === "dead_letter" ? "dead" : "failed"}
                    </span>
                    <code style={{ fontSize: "0.8rem" }}>
                      {item.event}
                      {item.action ? `.${item.action}` : ""}
                    </code>
                    <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>
                  {item.lastError && (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        opacity: 0.6,
                        margin: "0.25rem 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.lastError}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                  <Button
                    variant="default"
                    size="small"
                    onClick={() => void handleAction("retry", item.id)}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => void handleAction("discard", item.id)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.preferenceHint}>
            {deadLetterItems.length} dead-letter, {failedItems.length} failed
          </p>
        </>
      )}
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
