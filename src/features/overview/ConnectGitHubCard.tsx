import { MarkGithubIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./ConnectGitHubCard.module.css"

type ConnectGitHubCardProps = {
  onConnect: () => void
}

export const ConnectGitHubCard = ({ onConnect }: ConnectGitHubCardProps) => (
  <div className={styles.card}>
    <MarkGithubIcon size={48} />
    <h2 className={styles.title}>Connect your GitHub account</h2>
    <p className={styles.description}>
      Connect your GitHub account to sync your repositories, pull requests, and receive real-time
      webhook updates.
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
)
