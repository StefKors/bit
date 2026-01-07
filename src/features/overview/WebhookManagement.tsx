import { useState } from "react"
import {
  WebhookIcon,
  CheckCircleFillIcon,
  XCircleFillIcon,
  AlertFillIcon,
  CircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SyncIcon,
  RepoIcon,
} from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./WebhookManagement.module.css"

type WebhookStatus = "installed" | "error" | "not_installed" | "no_access"

type Repo = {
  id: string
  fullName: string
  webhookStatus?: string | null
  webhookError?: string | null
}

type WebhookManagementProps = {
  repos: Repo[]
  userId: string
}

type FilterType = "all" | "installed" | "no_access" | "error" | "pending"

const getStatusIcon = (status: WebhookStatus | undefined | null) => {
  switch (status) {
    case "installed":
      return <CheckCircleFillIcon size={14} className={styles.repoIconInstalled} />
    case "no_access":
      return <AlertFillIcon size={14} className={styles.repoIconNoAccess} />
    case "error":
      return <XCircleFillIcon size={14} className={styles.repoIconError} />
    default:
      return <CircleIcon size={14} className={styles.repoIconPending} />
  }
}

const getStatusLabel = (status: WebhookStatus | undefined | null) => {
  switch (status) {
    case "installed":
      return "Installed"
    case "no_access":
      return "No Access"
    case "error":
      return "Error"
    default:
      return "Pending"
  }
}

const getStatusClass = (status: WebhookStatus | undefined | null) => {
  switch (status) {
    case "installed":
      return styles.statusInstalled
    case "no_access":
      return styles.statusNoAccess
    case "error":
      return styles.statusError
    default:
      return styles.statusPending
  }
}

const RepoRow = ({ repo }: { repo: Repo }) => {
  const status = repo.webhookStatus as WebhookStatus | undefined

  return (
    <div className={styles.repoRow}>
      <RepoIcon size={14} className={styles.repoIcon} />
      <span className={styles.repoName}>{repo.fullName}</span>
      {repo.webhookError && (
        <span className={styles.repoError} title={repo.webhookError}>
          {repo.webhookError}
        </span>
      )}
      <span className={`${styles.repoStatus} ${getStatusClass(status)}`}>
        {getStatusLabel(status)}
      </span>
      {getStatusIcon(status)}
    </div>
  )
}

export const WebhookManagement = ({ repos, userId }: WebhookManagementProps) => {
  const [isRegistering, setIsRegistering] = useState(false)
  const [showRepos, setShowRepos] = useState(false)
  const [filter, setFilter] = useState<FilterType>("all")
  const [error, setError] = useState<string | null>(null)

  // Calculate stats
  const stats = repos.reduce(
    (acc, repo) => {
      const status = repo.webhookStatus
      if (status === "installed") acc.installed++
      else if (status === "no_access") acc.noAccess++
      else if (status === "error") acc.error++
      else acc.pending++
      return acc
    },
    { installed: 0, noAccess: 0, error: 0, pending: 0 },
  )

  // Filter repos based on selected filter
  const filteredRepos = repos.filter((repo) => {
    if (filter === "all") return true
    if (filter === "installed") return repo.webhookStatus === "installed"
    if (filter === "no_access") return repo.webhookStatus === "no_access"
    if (filter === "error") return repo.webhookStatus === "error"
    if (filter === "pending") return !repo.webhookStatus || repo.webhookStatus === "not_installed"
    return true
  })

  const handleRegisterWebhooks = async () => {
    setIsRegistering(true)
    setError(null)

    try {
      const response = await fetch("/api/github/sync/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
      })

      // Handle non-JSON responses gracefully
      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
        return
      }

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to register webhooks")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register webhooks"
      // Don't show JSON parse errors to user
      if (message.includes("JSON.parse") || message.includes("Unexpected token")) {
        setError("Server returned an invalid response. Please try again.")
      } else {
        setError(message)
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const hasIssues = stats.noAccess > 0 || stats.error > 0 || stats.pending > 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <WebhookIcon size={20} className={styles.headerIcon} />
          <div className={styles.headerText}>
            <h2 className={styles.title}>Webhook Management</h2>
            <p className={styles.description}>
              Webhooks enable real-time updates when PRs and issues change on GitHub.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="small"
          onClick={() => void handleRegisterWebhooks()}
          disabled={isRegistering}
        >
          {isRegistering ? (
            <span className={styles.buttonContent}>
              <SyncIcon size={14} className={styles.spinner} />
              Registering...
            </span>
          ) : (
            <span className={styles.buttonContent}>
              <SyncIcon size={14} />
              Register Webhooks
            </span>
          )}
        </Button>
      </div>

      {error && (
        <div
          style={{
            color: "var(--bit-color-accent-red)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statValueInstalled}`}>
            {stats.installed}
          </span>
          <span className={styles.statLabel}>Installed</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statValueNoAccess}`}>
            {stats.noAccess}
          </span>
          <span className={styles.statLabel}>No Access</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statValueError}`}>{stats.error}</span>
          <span className={styles.statLabel}>Errors</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statValuePending}`}>{stats.pending}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
      </div>

      {hasIssues && (
        <div className={styles.toggleSection}>
          <button className={styles.toggleButton} onClick={() => setShowRepos(!showRepos)}>
            <span className={styles.toggleCount}>{repos.length} repositories</span>
            {showRepos ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>

          {showRepos && (
            <div className={styles.reposContent}>
              <div className={styles.filterTabs}>
                <button
                  className={`${styles.filterTab} ${filter === "all" ? styles.filterTabActive : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All ({repos.length})
                </button>
                <button
                  className={`${styles.filterTab} ${filter === "installed" ? styles.filterTabActive : ""}`}
                  onClick={() => setFilter("installed")}
                >
                  Installed ({stats.installed})
                </button>
                <button
                  className={`${styles.filterTab} ${filter === "no_access" ? styles.filterTabActive : ""}`}
                  onClick={() => setFilter("no_access")}
                >
                  No Access ({stats.noAccess})
                </button>
                {stats.error > 0 && (
                  <button
                    className={`${styles.filterTab} ${filter === "error" ? styles.filterTabActive : ""}`}
                    onClick={() => setFilter("error")}
                  >
                    Errors ({stats.error})
                  </button>
                )}
                {stats.pending > 0 && (
                  <button
                    className={`${styles.filterTab} ${filter === "pending" ? styles.filterTabActive : ""}`}
                    onClick={() => setFilter("pending")}
                  >
                    Pending ({stats.pending})
                  </button>
                )}
              </div>

              <div className={`${styles.reposList} ${!showRepos ? styles.reposListCollapsed : ""}`}>
                {filteredRepos.length > 0 ? (
                  filteredRepos.map((repo) => <RepoRow key={repo.id} repo={repo} />)
                ) : (
                  <div className={styles.emptyState}>No repositories match this filter</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
