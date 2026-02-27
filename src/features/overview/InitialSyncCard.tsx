import { useState } from "react"
import {
  SyncIcon,
  CheckCircleFillIcon,
  CircleIcon,
  AlertIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./InitialSyncCard.module.css"

type InitialSyncProgress = {
  step: "orgs" | "repos" | "webhooks" | "pullRequests" | "completed"
  orgs?: { total: number }
  repos?: { total: number }
  webhooks?: { completed: number; total: number }
  pullRequests?: { completed: number; total: number; prsFound: number }
  error?: string
}

type SyncState = {
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

type SyncStepStatus = "completed" | "active" | "pending"

type InitialSyncCardProps = {
  progress: InitialSyncProgress | null
  syncStates: SyncState[]
  onResetSync: (resourceType: string, resourceId?: string) => void
  onRetrySync: (resourceType: string, resourceId?: string) => void
}

const SyncStepItem = ({
  label,
  status,
  count,
}: {
  label: string
  status: SyncStepStatus
  count?: string
}) => {
  const iconClass =
    status === "completed"
      ? styles.syncStepIconCompleted
      : status === "active"
        ? styles.syncStepIconActive
        : styles.syncStepIconPending

  const labelClass =
    status === "active"
      ? styles.syncStepLabelActive
      : status === "pending"
        ? styles.syncStepLabelPending
        : styles.syncStepLabel

  return (
    <div className={styles.syncStep}>
      <div className={`${styles.syncStepIcon} ${iconClass}`}>
        {status === "completed" ? (
          <CheckCircleFillIcon size={16} />
        ) : status === "active" ? (
          <SyncIcon size={16} />
        ) : (
          <CircleIcon size={16} />
        )}
      </div>
      <span className={labelClass}>{label}</span>
      {count && <span className={styles.syncStepCount}>{count}</span>}
    </div>
  )
}

const SyncErrorRow = ({
  state,
  onRetry,
  onReset,
}: {
  state: SyncState
  onRetry: () => void
  onReset: () => void
}) => {
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
      name += `: ${resourceId}`
    }
    return name
  }

  return (
    <div className={styles.errorRow}>
      <div className={styles.errorInfo}>
        <XCircleIcon size={14} className={styles.errorIcon} />
        <span className={styles.errorName}>
          {getDisplayName(state.resourceType, state.resourceId)}
        </span>
        <span className={styles.errorText}>{state.syncError}</span>
      </div>
      <div className={styles.errorActions}>
        <Button variant="invisible" size="small" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="invisible" size="small" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  )
}

export const InitialSyncCard = ({
  progress,
  syncStates,
  onResetSync,
  onRetrySync,
}: InitialSyncCardProps) => {
  const [showErrors, setShowErrors] = useState(true)

  const steps = ["orgs", "repos", "webhooks", "pullRequests"] as const
  const stepIndex = progress ? steps.indexOf(progress.step as (typeof steps)[number]) : 0
  const totalSteps = steps.length
  const progressPercent =
    progress?.step === "completed" ? 100 : ((stepIndex + 0.5) / totalSteps) * 100

  const getStepStatus = (step: string): SyncStepStatus => {
    if (!progress) return step === "orgs" ? "active" : "pending"
    if (progress.step === "completed") return "completed"
    const currentIndex = steps.indexOf(progress.step)
    const stepIdx = steps.indexOf(step as (typeof steps)[number])
    if (stepIdx < currentIndex) return "completed"
    if (stepIdx === currentIndex) return "active"
    return "pending"
  }

  const getStepCount = (step: string): string | undefined => {
    if (!progress) return undefined
    switch (step) {
      case "orgs":
        return progress.orgs ? `${progress.orgs.total} found` : undefined
      case "repos":
        return progress.repos ? `${progress.repos.total} found` : undefined
      case "webhooks":
        return progress.webhooks
          ? `${progress.webhooks.completed}/${progress.webhooks.total}`
          : undefined
      case "pullRequests":
        return progress.pullRequests
          ? `${progress.pullRequests.completed}/${progress.pullRequests.total} repos · ${progress.pullRequests.prsFound} PRs`
          : undefined
      default:
        return undefined
    }
  }

  // Filter sync states with errors
  const errorStates = syncStates.filter((state) => state.syncStatus === "error" || state.syncError)

  const hasErrors = errorStates.length > 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <SyncIcon size={20} className={styles.spinner} />
        <div className={styles.headerText}>
          <h2 className={styles.title}>Setting up your workspace</h2>
          <p className={styles.description}>
            We're syncing your GitHub data. This only happens once.
          </p>
        </div>
      </div>

      <div className={styles.progressBarContainer}>
        <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
      </div>

      <div className={styles.stepsGrid}>
        <SyncStepItem
          label="Organizations"
          status={getStepStatus("orgs")}
          count={getStepCount("orgs")}
        />
        <SyncStepItem
          label="Repositories"
          status={getStepStatus("repos")}
          count={getStepCount("repos")}
        />
        <SyncStepItem
          label="Webhooks"
          status={getStepStatus("webhooks")}
          count={getStepCount("webhooks")}
        />
        <SyncStepItem
          label="Pull Requests"
          status={getStepStatus("pullRequests")}
          count={getStepCount("pullRequests")}
        />
      </div>

      {hasErrors && (
        <div className={styles.errorsSection}>
          <button
            className={styles.errorsToggle}
            onClick={() => {
              setShowErrors(!showErrors)
            }}
            aria-expanded={showErrors}
          >
            <AlertIcon size={14} className={styles.alertIcon} />
            <span className={styles.errorsCount}>
              {errorStates.length} sync {errorStates.length === 1 ? "issue" : "issues"}
            </span>
            {showErrors ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>

          {showErrors && (
            <div className={styles.errorsList}>
              {errorStates.map((state) => (
                <SyncErrorRow
                  key={state.id}
                  state={state}
                  onRetry={() => {
                    onRetrySync(state.resourceType, state.resourceId)
                  }}
                  onReset={() => {
                    onResetSync(state.resourceType, state.resourceId)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
