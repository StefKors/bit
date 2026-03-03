import { useQuery } from "@tanstack/react-query"
import {
  CheckCircleFillIcon,
  XCircleFillIcon,
  AlertFillIcon,
  OrganizationIcon,
  RepoIcon,
} from "@primer/octicons-react"
import type { WebhookLevelsResponse } from "@/routes/api/github/webhook-levels"
import styles from "./WebhookLevelCard.module.css"

interface WebhookLevelCardProps {
  userId: string
}

const fetchWebhookLevels = async (userId: string): Promise<WebhookLevelsResponse> => {
  const res = await fetch("/api/github/webhook-levels", {
    headers: { Authorization: `Bearer ${userId}` },
  })
  const data = (await res.json()) as WebhookLevelsResponse & { error?: string }
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch webhook levels")
  return data
}

const OrgLevelBadge = ({
  level,
  error,
}: {
  level: "has_webhooks" | "no_webhooks" | "no_access"
  error?: string
}) => {
  switch (level) {
    case "has_webhooks":
      return (
        <span className={styles.levelBadge} title={error}>
          <CheckCircleFillIcon size={12} className={styles.levelIconOk} />
          Org webhooks
        </span>
      )
    case "no_access":
      return (
        <span className={styles.levelBadge} title={error}>
          <AlertFillIcon size={12} className={styles.levelIconNoAccess} />
          No access
        </span>
      )
    default:
      return (
        <span className={styles.levelBadge} title={error}>
          <XCircleFillIcon size={12} className={styles.levelIconNone} />
          No org webhooks
        </span>
      )
  }
}

export const WebhookLevelCard = ({ userId }: WebhookLevelCardProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["webhook-levels", userId],
    queryFn: () => fetchWebhookLevels(userId),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Webhook setup level</h2>
        <p className={styles.loading}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Webhook setup level</h2>
        <p className={styles.error}>{error instanceof Error ? error.message : "Failed to load"}</p>
      </div>
    )
  }

  if (!data) return null

  const { orgs, repos } = data

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Webhook setup level</h2>
      <p className={styles.description}>
        Where webhooks are configured: organization-level (all repos in org) or repository-level
        (per repo).
      </p>

      {orgs.length > 0 && (
        <div className={styles.levelSection}>
          <div className={styles.levelLabel}>
            <OrganizationIcon size={14} />
            Organization level
          </div>
          <div className={styles.levelItems}>
            {orgs.map((org) => (
              <div key={org.login} className={styles.levelRow}>
                <span className={styles.orgLogin}>{org.login}</span>
                <OrgLevelBadge level={org.level} error={org.error} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.levelSection}>
        <div className={styles.levelLabel}>
          <RepoIcon size={14} />
          Repository level
        </div>
        <div className={styles.statsRow}>
          <span className={styles.stat}>
            <CheckCircleFillIcon size={12} className={styles.levelIconOk} />
            {repos.installed} installed
          </span>
          <span className={styles.stat}>
            <XCircleFillIcon size={12} className={styles.levelIconNone} />
            {repos.pending} pending
          </span>
          {repos.noAccess > 0 && (
            <span className={styles.stat}>
              <AlertFillIcon size={12} className={styles.levelIconNoAccess} />
              {repos.noAccess} no access
            </span>
          )}
          {repos.error > 0 && (
            <span className={styles.stat}>
              <XCircleFillIcon size={12} className={styles.levelIconError} />
              {repos.error} errors
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
