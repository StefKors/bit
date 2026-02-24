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
  revokeUrl?: string
  error: string | null
  onConnectGitHub: () => void
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
  revokeUrl,
  error,
  onConnectGitHub,
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
          ) : isGitHubConnected ? null : (
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

      {oauthError && (
        <div className={styles.errorMessage}>
          {oauthError}
          {revokeUrl ? (
            <>
              {" "}
              <a
                href={revokeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.revokeLink}
              >
                Revoke the app on GitHub
              </a>
              , then click Connect GitHub again to approve all permissions.
            </>
          ) : (
            " Please reconnect and approve all requested permissions."
          )}
        </div>
      )}

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
