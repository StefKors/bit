import { MarkGithubIcon, CheckCircleFillIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./ConnectGitHubCard.module.css"

type ConnectGitHubCardProps = {
  onConnect: () => void
  justInstalled?: boolean
  message?: string
}

export const ConnectGitHubCard = ({
  onConnect,
  justInstalled,
  message,
}: ConnectGitHubCardProps) => (
  <div className={styles.card}>
    <MarkGithubIcon size={48} />
    {justInstalled ? (
      <>
        <div className={styles.installedBadge}>
          <CheckCircleFillIcon size={16} />
          App Installed!
        </div>
        <h2 className={styles.title}>Complete your GitHub connection</h2>
        <p className={styles.description}>
          {message || "The GitHub App is installed. Click below to authorize and start syncing."}
        </p>
      </>
    ) : (
      <>
        <h2 className={styles.title}>Connect your GitHub account</h2>
        <p className={styles.description}>
          Connect your GitHub account to sync your repositories, pull requests, and receive
          real-time webhook updates.
        </p>
      </>
    )}
    <Button
      variant="primary"
      size="large"
      leadingIcon={<MarkGithubIcon size={20} />}
      onClick={onConnect}
    >
      {justInstalled ? "Authorize & Connect" : "Connect GitHub"}
    </Button>
  </div>
)
