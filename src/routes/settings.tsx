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
  CpuIcon,
  PersonIcon,
  DatabaseIcon,
  ColumnsIcon,
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
import { CEREBRAS_MODELS, DEFAULT_MODEL } from "@/lib/cerebras"
import { getPRLayoutMode, setPRLayoutMode, type PRLayoutMode } from "@/lib/pr-layout-preference"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import { SyncManagement } from "@/components/SyncManagement"
import { WebhookManagement } from "@/features/overview"
import styles from "@/pages/SettingsPage.module.css"

type WebhookSyncMode = "minimal" | "full" | "full-force"
type Section = "github" | "repos" | "webhooks" | "interface" | "ai" | "data" | "account"

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

const AI_MODEL_OPTIONS = CEREBRAS_MODELS.map((m) => ({
  value: m.id,
  label: m.label,
  description: m.description,
}))

const GITHUB_APP_SLUG = "bit-backend"
const GITHUB_APP_INSTALLATIONS_URL = "https://github.com/settings/installations"

const SIDEBAR_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "github", label: "GitHub", icon: <MarkGithubIcon size={16} /> },
  { id: "repos", label: "Repositories", icon: <RepoIcon size={16} /> },
  { id: "webhooks", label: "Webhooks", icon: <SyncIcon size={16} /> },
  { id: "interface", label: "Interface", icon: <ColumnsIcon size={16} /> },
  { id: "ai", label: "AI Features", icon: <CpuIcon size={16} /> },
  { id: "data", label: "Data & Storage", icon: <DatabaseIcon size={16} /> },
  { id: "account", label: "Account", icon: <PersonIcon size={16} /> },
]

function SettingsPage() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<Section>("github")
  const [prLayoutMode, setPrLayoutModeState] = useState<PRLayoutMode>(() => getPRLayoutMode())

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
  const currentAiEnabled = userSettingsRecord?.aiEnabled !== false
  const currentAiModel = (userSettingsRecord?.aiModel as string) || DEFAULT_MODEL
  const webhookLogsEnabled = userSettingsRecord?.webhookLogsEnabled !== false

  const tokenState = syncStates.find((s) => s.resourceType === "github:token")
  const isGitHubConnected = Boolean(tokenState)
  const isAuthInvalid = tokenState?.syncStatus === "auth_invalid"

  const initialSyncState = syncStates.find((s) => s.resourceType === "initial_sync")
  const lastSyncedAt = initialSyncState?.lastSyncedAt

  const isFullScreenPRLayout = prLayoutMode === "full-screen-3-column"
  const githubAppInstallUrl = user?.id
    ? `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?${new URLSearchParams({ state: user.id }).toString()}`
    : `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`

  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- partial update accepts arbitrary field values
  const updateSettings = (fields: Record<string, unknown>) => {
    if (!user?.id) return
    const now = Date.now()
    const settingsId = userSettingsRecord?.id || id()
    void db.transact(
      db.tx.userSettings[settingsId]
        .update({
          ...fields,
          userId: user.id,
          createdAt: userSettingsRecord?.createdAt ?? now,
          updatedAt: now,
        })
        .link({ user: user.id }),
    )
  }

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
        // navigation will happen on success
      }
    })()
  }

  if (!user) return null

  const renderContent = () => {
    switch (activeSection) {
      case "github":
        return (
          <GitHubSection
            user={user}
            isGitHubConnected={isGitHubConnected}
            isAuthInvalid={isAuthInvalid}
            lastSyncedAt={lastSyncedAt}
            disconnecting={disconnecting}
            githubAppInstallUrl={githubAppInstallUrl}
            onConnect={handleConnectGitHub}
            onDisconnect={() => disconnect.mutate()}
          />
        )
      case "repos":
        return isGitHubConnected && !isAuthInvalid ? (
          <ReposSection userId={user.id} />
        ) : (
          <div className={styles.card}>
            <p className={styles.preferenceDescription}>
              Connect your GitHub account first to add repositories.
            </p>
          </div>
        )
      case "webhooks":
        return (
          <WebhooksSection
            currentSyncMode={currentSyncMode}
            onSyncModeChange={(mode) => {
              updateSettings({ webhookPrSyncBehavior: mode })
            }}
            isGitHubConnected={isGitHubConnected}
            isAuthInvalid={isAuthInvalid}
            syncStates={syncStates as SyncStateItem[]}
            repos={repos as RepoItem[]}
            userId={user.id}
            overviewSyncPending={overviewSync.isPending}
            onOverviewSync={() => {
              overviewSync.mutate()
            }}
            onResetSync={(type, resId) => {
              resetSync.mutate({ resourceType: type, resourceId: resId })
            }}
            onRetrySync={(type, resId) => {
              retrySync.mutate({ resourceType: type, resourceId: resId })
            }}
          />
        )
      case "interface":
        return (
          <InterfaceSection
            isFullScreen={isFullScreenPRLayout}
            onToggle={() => {
              const next: PRLayoutMode = isFullScreenPRLayout ? "default" : "full-screen-3-column"
              setPrLayoutModeState(next)
              setPRLayoutMode(next)
            }}
          />
        )
      case "ai":
        return (
          <AISection
            enabled={currentAiEnabled}
            model={currentAiModel}
            onToggle={() => updateSettings({ aiEnabled: !currentAiEnabled })}
            onModelChange={(model) => updateSettings({ aiModel: model })}
          />
        )
      case "data":
        return (
          <DataSection
            webhookLogsEnabled={webhookLogsEnabled}
            onToggleLogs={() => updateSettings({ webhookLogsEnabled: !webhookLogsEnabled })}
          />
        )
      case "account":
        return <AccountSection email={user.email} />
      default:
        return null
    }
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Settings</div>
        <div className={styles.sidebarNav}>
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.sidebarItem} ${activeSection === item.id ? styles.sidebarItemActive : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className={styles.sidebarIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <main className={styles.content}>
        <h1 className={styles.pageTitle}>
          {SIDEBAR_ITEMS.find((i) => i.id === activeSection)?.label ?? "Settings"}
        </h1>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {success && <div className={styles.successBanner}>{success}</div>}
        {renderContent()}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GitHub Section                                                     */
/* ------------------------------------------------------------------ */

interface GitHubSectionProps {
  user: {
    name?: string | null
    login?: string | null
    avatarUrl?: string | null
    htmlUrl?: string | null
  }
  isGitHubConnected: boolean
  isAuthInvalid: boolean
  lastSyncedAt: number | undefined | null
  disconnecting: boolean
  githubAppInstallUrl: string
  onConnect: () => void
  onDisconnect: () => void
}

const GitHubSection = ({
  user,
  isGitHubConnected,
  isAuthInvalid,
  lastSyncedAt,
  disconnecting,
  githubAppInstallUrl,
  onConnect,
  onDisconnect,
}: GitHubSectionProps) => {
  if (!isGitHubConnected) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyConnection}>
          <MarkGithubIcon size={40} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No GitHub account connected</h3>
          <p className={styles.emptyDescription}>
            Connect your GitHub account to sync repositories, pull requests, and receive real-time
            updates.
          </p>
          <Button
            variant="primary"
            size="large"
            leadingIcon={<MarkGithubIcon size={20} />}
            onClick={onConnect}
          >
            Connect GitHub
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
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
                Your GitHub token is no longer valid. Reconnect to resume syncing repositories and
                pull requests.
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
            onClick={onConnect}
          >
            {isAuthInvalid ? "Reconnect GitHub" : "Reconnect"}
          </Button>
          <Button
            variant="danger"
            leadingIcon={<TrashIcon size={16} />}
            loading={disconnecting}
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.preferenceInfo}>
          <span className={styles.preferenceLabel}>GitHub App</span>
          <p className={styles.preferenceDescription}>
            Manage GitHub App installations. Install to grant access to additional orgs or repos.
          </p>
        </div>
        <div className={styles.appActions}>
          <Button
            variant="default"
            onClick={() => {
              window.location.href = githubAppInstallUrl
            }}
          >
            Install
          </Button>
          <Button
            variant="default"
            onClick={() => {
              window.location.href = GITHUB_APP_INSTALLATIONS_URL
            }}
          >
            Manage
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              window.location.href = GITHUB_APP_INSTALLATIONS_URL
            }}
          >
            Remove
          </Button>
        </div>
        <div className={styles.permissionsHint}>
          <AlertIcon size={14} />
          <p>
            Organization access can depend on GitHub org policies. If repos or webhooks are missing,
            ask an org admin to approve the OAuth app and authorize the token for org SAML SSO.
          </p>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Repos Section                                                      */
/* ------------------------------------------------------------------ */

const ReposSection = ({ userId }: { userId: string }) => {
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

  return (
    <div className={styles.card}>
      <div className={styles.preferenceInfo}>
        <span className={styles.preferenceLabel}>Add Repository</span>
        <p className={styles.preferenceDescription}>
          Paste a GitHub URL or type owner/repo to track a specific repository.
        </p>
      </div>
      <div className={styles.addRepoRow} style={{ marginTop: "0.75rem" }}>
        <RepoIcon size={16} className={styles.addRepoIcon} />
        <input
          ref={inputRef}
          type="text"
          className={styles.addRepoInput}
          placeholder="https://github.com/owner/repo or owner/repo"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddRepo()
          }}
          disabled={adding}
        />
        <Button
          variant="primary"
          size="small"
          leadingIcon={<PlusIcon size={16} />}
          loading={adding}
          onClick={handleAddRepo}
        >
          Add
        </Button>
      </div>
      {addError && <div className={styles.addRepoError}>{addError}</div>}
      {addSuccess && <div className={styles.addRepoSuccess}>{addSuccess}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Webhooks Section                                                   */
/* ------------------------------------------------------------------ */

interface SyncStateItem {
  id: string
  resourceType: string
  resourceId?: string
  lastSyncedAt?: number
  lastEtag?: string
  syncStatus?: string
  syncError?: string
  rateLimitRemaining?: number
  rateLimitReset?: number
}

interface RepoItem {
  id: string
  fullName: string
  webhookStatus?: string | null
  webhookError?: string | null
}

interface WebhooksSectionProps {
  currentSyncMode: WebhookSyncMode
  onSyncModeChange: (mode: WebhookSyncMode) => void
  isGitHubConnected: boolean
  isAuthInvalid: boolean
  syncStates: SyncStateItem[]
  repos: RepoItem[]
  userId: string
  overviewSyncPending: boolean
  onOverviewSync: () => void
  onResetSync: (resourceType: string, resourceId?: string) => void
  onRetrySync: (resourceType: string, resourceId?: string) => void
}

const WebhooksSection = ({
  currentSyncMode,
  onSyncModeChange,
  isGitHubConnected,
  isAuthInvalid,
  syncStates,
  repos,
  userId,
  overviewSyncPending,
  onOverviewSync,
  onResetSync,
  onRetrySync,
}: WebhooksSectionProps) => (
  <>
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Sync Behavior</h2>
      <div className={styles.card}>
        <div className={styles.preferenceInfo}>
          <span className={styles.preferenceLabel}>PR detail sync mode</span>
          <p className={styles.preferenceDescription}>
            Controls how much data is fetched when GitHub webhook events arrive for pull requests.
          </p>
        </div>
        <div className={styles.radioGroup} style={{ marginTop: "0.75rem" }}>
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
                  onSyncModeChange(option.value)
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
      <>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Queue</h2>
          <WebhookQueueCard />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Debug</h2>
          <div className={styles.card}>
            <div className={styles.preferenceRow}>
              <div className={styles.preferenceInfo}>
                <span className={styles.preferenceLabel}>Sync Overview</span>
                <p className={styles.preferenceDescription}>
                  Manually trigger a full overview sync (repos, orgs, PRs).
                </p>
              </div>
              <Button
                variant="default"
                size="small"
                leadingIcon={<SyncIcon size={14} />}
                loading={overviewSyncPending}
                onClick={onOverviewSync}
              >
                Sync
              </Button>
            </div>
          </div>
          <SyncManagement
            syncStates={syncStates}
            onResetSync={onResetSync}
            onRetrySync={onRetrySync}
          />
          <div style={{ marginTop: "0.75rem" }}>
            <WebhookManagement repos={repos} userId={userId} />
          </div>
        </section>
      </>
    )}
  </>
)

/* ------------------------------------------------------------------ */
/*  Interface Section                                                  */
/* ------------------------------------------------------------------ */

const InterfaceSection = ({
  isFullScreen,
  onToggle,
}: {
  isFullScreen: boolean
  onToggle: () => void
}) => (
  <div className={styles.card}>
    <div className={styles.preferenceRow}>
      <div className={styles.preferenceInfo}>
        <span className={styles.preferenceLabel}>Full-screen PR workspace</span>
        <p className={styles.preferenceDescription}>
          Shows pull requests in a 3-column layout with PR list, diffs, and activity feed.
        </p>
      </div>
      <button
        type="button"
        className={`${styles.toggleSwitch} ${isFullScreen ? styles.toggleSwitchOn : ""}`}
        aria-label="Enable full-screen PR workspace"
        aria-pressed={isFullScreen}
        onClick={onToggle}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
    <p className={styles.preferenceHint}>Applies to repository pull request detail pages.</p>
  </div>
)

/* ------------------------------------------------------------------ */
/*  AI Section                                                         */
/* ------------------------------------------------------------------ */

interface AISectionProps {
  enabled: boolean
  model: string
  onToggle: () => void
  onModelChange: (model: string) => void
}

const AISection = ({ enabled, model, onToggle, onModelChange }: AISectionProps) => (
  <>
    <div className={styles.card}>
      <div className={styles.preferenceRow}>
        <div className={styles.preferenceInfo}>
          <span className={styles.preferenceLabel}>Enable AI-powered insights</span>
          <p className={styles.preferenceDescription}>
            Uses Cerebras Cloud to generate activity summaries, action suggestions, and enable the
            AI chat assistant on the dashboard.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.toggleSwitch} ${enabled ? styles.toggleSwitchOn : ""}`}
          aria-label="Enable AI features"
          aria-pressed={enabled}
          onClick={onToggle}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>
    </div>

    <div className={styles.card}>
      <div className={styles.preferenceInfo}>
        <span className={styles.preferenceLabel}>Model</span>
        <p className={styles.preferenceDescription}>
          Choose the Cerebras model for AI features. Faster models use fewer resources.
        </p>
      </div>
      <div className={styles.radioGroup} style={{ marginTop: "0.75rem" }}>
        {AI_MODEL_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`${styles.radioOption} ${model === option.value ? styles.radioOptionSelected : ""}`}
          >
            <input
              type="radio"
              name="aiModel"
              className={styles.radioInput}
              value={option.value}
              checked={model === option.value}
              onChange={() => {
                onModelChange(option.value)
              }}
            />
            <div className={styles.radioContent}>
              <span className={styles.radioLabel}>{option.label}</span>
              <p className={styles.radioDescription}>{option.description}</p>
            </div>
          </label>
        ))}
      </div>
      <div className={styles.permissionsHint}>
        <AlertIcon size={14} />
        <p>
          The API key is configured via the <code>CEREBRAS_API_KEY</code> environment variable on
          the server. Visit{" "}
          <a
            href="https://cloud.cerebras.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            cloud.cerebras.ai
          </a>{" "}
          to get your key.
        </p>
      </div>
    </div>
  </>
)

/* ------------------------------------------------------------------ */
/*  Data & Storage Section                                             */
/* ------------------------------------------------------------------ */

interface DataSectionProps {
  webhookLogsEnabled: boolean
  onToggleLogs: () => void
}

const DataSection = ({ webhookLogsEnabled, onToggleLogs }: DataSectionProps) => {
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [purgeError, setPurgeError] = useState<string | null>(null)

  const handlePurge = async () => {
    setPurging(true)
    setPurgeResult(null)
    setPurgeError(null)
    try {
      const res = await fetch("/api/github/webhook-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge-all" }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        deleted?: number
        deliveriesDeleted?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Purge failed")
      const queueCount = data.deleted ?? 0
      const deliveryCount = data.deliveriesDeleted ?? 0
      setPurgeResult(`Purged ${queueCount} queue items and ${deliveryCount} delivery records.`)
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : "Purge failed")
    } finally {
      setPurging(false)
    }
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.preferenceRow}>
          <div className={styles.preferenceInfo}>
            <span className={styles.preferenceLabel}>Keep webhook debug logs</span>
            <p className={styles.preferenceDescription}>
              Processed webhook queue items and delivery records are retained for debugging. Disable
              to keep the database lean.
            </p>
          </div>
          <button
            type="button"
            className={`${styles.toggleSwitch} ${webhookLogsEnabled ? styles.toggleSwitchOn : ""}`}
            aria-label="Keep webhook debug logs"
            aria-pressed={webhookLogsEnabled}
            onClick={onToggleLogs}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
        <p className={styles.preferenceHint}>
          {webhookLogsEnabled
            ? "Processed items are kept for 7 days, dead-letter items for 30 days."
            : "Processed items and delivery records are deleted immediately after processing."}
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.preferenceRow}>
          <div className={styles.preferenceInfo}>
            <span className={styles.preferenceLabel}>Purge webhook data</span>
            <p className={styles.preferenceDescription}>
              Delete all processed and dead-letter queue items and delivery records now. Failed
              items pending retry are kept.
            </p>
          </div>
          <Button
            variant="danger"
            size="small"
            leadingIcon={<TrashIcon size={14} />}
            loading={purging}
            onClick={() => void handlePurge()}
          >
            Purge
          </Button>
        </div>
        {purgeResult && (
          <div className={styles.successBanner} style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            {purgeResult}
          </div>
        )}
        {purgeError && (
          <div className={styles.errorBanner} style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            {purgeError}
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Account Section                                                    */
/* ------------------------------------------------------------------ */

const AccountSection = ({ email }: { email?: string | null }) => (
  <div className={styles.card}>
    <div className={styles.accountRow}>
      <div>
        <span className={styles.accountLabel}>Email</span>
        <span className={styles.accountValue}>{email ?? "—"}</span>
      </div>
    </div>
  </div>
)

/* ------------------------------------------------------------------ */
/*  Webhook Queue Card (reused from webhooks section)                  */
/* ------------------------------------------------------------------ */

interface QueueItem {
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

const WebhookQueueCard = () => {
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

      {queueError && (
        <div className={styles.errorBanner} style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          {queueError}
        </div>
      )}

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

          <div style={{ marginTop: "0.75rem" }}>
            {items.map((item) => (
              <div key={item.id} className={styles.queueItemRow}>
                <div className={styles.queueItemInfo}>
                  <div className={styles.queueItemMeta}>
                    <span
                      className={`${styles.queueItemStatus} ${item.status === "dead_letter" ? styles.queueItemStatusDead : styles.queueItemStatusFailed}`}
                    >
                      {item.status === "dead_letter" ? "dead" : "failed"}
                    </span>
                    <code className={styles.queueItemEvent}>
                      {item.event}
                      {item.action ? `.${item.action}` : ""}
                    </code>
                    <span className={styles.queueItemTime}>{formatTimeAgo(item.createdAt)}</span>
                  </div>
                  {item.lastError && <p className={styles.queueItemError}>{item.lastError}</p>}
                </div>
                <div className={styles.queueItemActions}>
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp
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
