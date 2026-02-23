import { ClockIcon, SyncIcon, MarkGithubIcon, CheckCircleIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./OverviewHeader.module.css"

type RateLimitInfo = {
  remaining: number
  limit: number
  reset: Date
}

type OverviewHeaderProps = {
  isGitHubConnected: boolean
  isAuthInvalid?: boolean
  isSyncing: boolean
  rateLimit: RateLimitInfo | null
  lastSyncedAt?: number
  syncError?: string
  githubJustConnected: boolean
  oauthError?: string
  error: string | null
  onSync: () => void
  onConnectGitHub: () => void
  showSyncManagement: boolean
  onToggleSyncManagement: () => void
  hasSyncErrors: boolean
}

const formatLastSynced = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp * 1000
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (diff < 60000) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export const OverviewHeader = ({
  isGitHubConnected,
  isAuthInvalid,
  isSyncing,
  rateLimit,
  lastSyncedAt,
  syncError,
  githubJustConnected,
  oauthError,
  error,
  onSync,
  onConnectGitHub,
  showSyncManagement,
  onToggleSyncManagement,
  hasSyncErrors,
}: OverviewHeaderProps) => {
  const rateLimitLow = rateLimit && rateLimit.remaining < 100

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Pull Requests</h1>
        </div>

        <div className={styles.headerActions}>
          {rateLimit && (
            <div className={`${styles.rateLimit} ${rateLimitLow ? styles.rateLimitLow : ""}`}>
              <ClockIcon className={styles.buttonIcon} size={16} />
              {rateLimit.remaining}/{rateLimit.limit} requests
            </div>
          )}

          {isGitHubConnected && isAuthInvalid ? (
            <Button
              variant="danger"
              leadingIcon={<MarkGithubIcon size={16} />}
              onClick={onConnectGitHub}
            >
              Reconnect GitHub
            </Button>
          ) : isGitHubConnected ? (
            <>
              {hasSyncErrors && (
                <Button variant="danger" onClick={onToggleSyncManagement}>
                  {showSyncManagement ? "Hide Sync Issues" : "Show Sync Issues"}
                </Button>
              )}
              <Button
                variant="success"
                leadingIcon={<SyncIcon size={16} />}
                loading={isSyncing}
                disabled={isSyncing}
                onClick={onSync}
              >
                {isSyncing ? "Syncing..." : "Sync GitHub"}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              leadingIcon={<MarkGithubIcon size={16} />}
              onClick={onConnectGitHub}
            >
              Connect GitHub
            </Button>
          )}
        </div>
      </header>

      {githubJustConnected && (
        <div className={styles.successMessage}>
          <CheckCircleIcon size={16} />
          GitHub connected successfully! You can now sync your repositories.
        </div>
      )}

      {isAuthInvalid && (
        <div className={styles.errorMessage}>
          Your GitHub connection has expired. Please reconnect to continue syncing.
        </div>
      )}

      {oauthError && <div className={styles.errorMessage}>{oauthError}</div>}

      {error && !isAuthInvalid && <div className={styles.errorMessage}>{error}</div>}

      {isGitHubConnected && (
        <div className={styles.syncStatus}>
          {isSyncing ? (
            <div className={styles.syncStatusSyncing}>
              <SyncIcon size={16} className={styles.syncStatusIcon} />
              Syncing GitHub data...
            </div>
          ) : syncError ? (
            <div className={styles.syncStatusError}>Sync error: {syncError}</div>
          ) : lastSyncedAt ? (
            <div className={styles.syncStatusInfo}>
              <ClockIcon size={16} className={styles.syncStatusIcon} />
              Last synced {formatLastSynced(lastSyncedAt)}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
