import { useState } from "react"
import {
  SyncIcon,
  CheckCircleIcon,
  AlertIcon,
  XCircleIcon,
  SyncIcon as ResetIcon,
} from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./SyncManagement.module.css"

interface SyncState {
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

interface SyncManagementProps {
  syncStates: SyncState[]
  onResetSync: (resourceType: string, resourceId?: string) => void
  onRetrySync: (resourceType: string, resourceId?: string) => void
}

export function SyncManagement({ syncStates, onResetSync, onRetrySync }: SyncManagementProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "completed":
      case "idle":
        return <CheckCircleIcon size={16} className={styles.statusIconSuccess} />
      case "syncing":
        return <SyncIcon size={16} className={styles.statusIconSyncing} />
      case "error":
        return <XCircleIcon size={16} className={styles.statusIconError} />
      default:
        return <AlertIcon size={16} className={styles.statusIconWarning} />
    }
  }

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return "Never"
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

  const getDisplayName = (resourceType: string, resourceId?: string) => {
    const typeNames: Record<string, string> = {
      initial_sync: "Initial Sync",
      overview: "Overview",
      orgs: "Organizations",
      repos: "Repositories",
      pulls: "Pull Requests",
      "pr-detail": "PR Details",
      tree: "Repository Tree",
      webhooks: "Webhooks",
      "github:token": "GitHub Token",
    }

    let name = typeNames[resourceType] || resourceType
    if (resourceId) {
      name += ` - ${resourceId}`
    }
    return name
  }

  const parseETag = (etag?: string) => {
    if (!etag) return null
    try {
      return JSON.parse(etag)
    } catch {
      return null
    }
  }

  // Group sync states by type
  const groupedStates = syncStates.reduce(
    (acc, state) => {
      const key = state.resourceType
      if (!acc[key]) acc[key] = []
      acc[key].push(state)
      return acc
    },
    {} as Record<string, SyncState[]>,
  )

  const hasErrors = syncStates.some((state) => state.syncStatus === "error" || state.syncError)

  return (
    <div className={styles.syncManagement}>
      <div className={styles.syncManagementHeader}>
        <h2 className={styles.syncManagementTitle}>
          {hasErrors ? (
            <AlertIcon size={20} className={styles.titleIconError} />
          ) : (
            <SyncIcon size={20} className={styles.titleIcon} />
          )}
          Sync Management
        </h2>
        <p className={styles.syncManagementDescription}>
          Monitor and manage your GitHub data synchronization
        </p>
      </div>

      <div className={styles.syncStatesList}>
        {Object.entries(groupedStates).map(([resourceType, states]) => (
          <div key={resourceType} className={styles.syncGroup}>
            <div className={styles.syncGroupHeader}>
              <h3 className={styles.syncGroupTitle}>{getDisplayName(resourceType)}</h3>
              {states.some((s) => s.syncStatus === "error") && (
                <span className={styles.errorBadge}>Error</span>
              )}
            </div>

            {states.map((state) => (
              <div key={state.id} className={styles.syncStateItem}>
                <div className={styles.syncStateMain}>
                  <div className={styles.syncStateInfo}>
                    <div className={styles.syncStateHeader}>
                      {getStatusIcon(state.syncStatus)}
                      <span className={styles.syncStateName}>
                        {state.resourceId || getDisplayName(state.resourceType)}
                      </span>
                      <span className={styles.syncStateStatus}>
                        {state.syncStatus || "unknown"}
                      </span>
                    </div>

                    <div className={styles.syncStateMeta}>
                      <span className={styles.lastSynced}>
                        Last synced: {formatLastSynced(state.lastSyncedAt)}
                      </span>
                      {state.rateLimitRemaining !== undefined && (
                        <span className={styles.rateLimit}>
                          Rate limit: {state.rateLimitRemaining} remaining
                        </span>
                      )}
                    </div>

                    {state.syncError && (
                      <div className={styles.errorMessage}>
                        <XCircleIcon size={12} />
                        {state.syncError}
                      </div>
                    )}
                  </div>

                  <div className={styles.syncStateActions}>
                    {(state.syncStatus === "error" || state.syncError) && (
                      <Button
                        variant="success"
                        size="small"
                        leadingIcon={<SyncIcon size={14} />}
                        onClick={() => onRetrySync(state.resourceType, state.resourceId)}
                      >
                        Retry
                      </Button>
                    )}

                    <Button
                      variant="default"
                      size="small"
                      leadingIcon={<ResetIcon size={14} />}
                      onClick={() => onResetSync(state.resourceType, state.resourceId)}
                    >
                      Reset
                    </Button>

                    {state.lastEtag && (
                      <Button
                        variant="invisible"
                        size="small"
                        onClick={() => toggleExpanded(state.id)}
                      >
                        {expandedItems.has(state.id) ? "Hide" : "Show"} Details
                      </Button>
                    )}
                  </div>
                </div>

                {expandedItems.has(state.id) && state.lastEtag && (
                  <div className={styles.syncStateDetails}>
                    <h4>ETag/Progress Data:</h4>
                    <pre className={styles.etagData}>
                      {JSON.stringify(parseETag(state.lastEtag), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {syncStates.length === 0 && (
          <div className={styles.emptyState}>
            <SyncIcon size={32} className={styles.emptyStateIcon} />
            <p>No sync states found</p>
          </div>
        )}
      </div>
    </div>
  )
}
