import { Link, useSearch } from "@tanstack/react-router"
import { LinkExternalIcon, RepoIcon } from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/UseAuth"
import { resolveUserAvatarUrl } from "@/lib/Avatar"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { db } from "@/lib/InstantDb"
import styles from "./HomePage.module.css"

export function HomePage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })
  const { data } = db.useQuery({
    repos: {
      $: { order: { pushedAt: "desc" } },
    },
  })
  const repos = data?.repos ?? []
  const githubConnected = search.github === "connected"
  const oauthError = search.error
  const oauthMessage = search.message

  const handleConnectGitHub = () => {
    if (!user?.id) return
    window.location.href = `/api/github/oauth/?userId=${user.id}`
  }

  const handleDisconnectGitHub = () => {
    window.open("https://github.com/settings/installations", "_blank", "noopener,noreferrer")
  }

  if (!user) {
    return <div className={styles.loading}>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Avatar
            src={resolveUserAvatarUrl(user)}
            name={user.name || user.login || user.email}
            size={64}
          />
          <h1 className={styles.title}>
            {user.name || user.login || user.email?.split("@")[0] || "there"}
          </h1>
          <p className={styles.subtitle}>{user.login ? `@${user.login}` : user.email}</p>
        </div>

        {oauthError && <div className={styles.error}>{oauthError}</div>}
        {githubConnected && (
          <div className={styles.success}>{oauthMessage || "GitHub connected successfully!"}</div>
        )}

        {!user.login ? (
          <div className={styles.section}>
            <p className={styles.sectionText}>Connect your GitHub account to get started.</p>
            <Button
              variant="primary"
              size="large"
              block
              leadingIcon={<LinkExternalIcon size={20} />}
              onClick={handleConnectGitHub}
            >
              Install GitHub App
            </Button>
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.settingsSection}>
              <h2 className={styles.settingsTitle}>Integrations</h2>
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <p className={styles.settingName}>GitHub App</p>
                  <p className={styles.settingStatus}>Connected as @{user.login}</p>
                </div>
                <div className={styles.settingActions}>
                  <button
                    type="button"
                    className={styles.settingsButton}
                    onClick={handleConnectGitHub}
                  >
                    Reconnect
                  </button>
                  <button
                    type="button"
                    className={`${styles.settingsButton} ${styles.settingsButtonDanger}`}
                    onClick={handleDisconnectGitHub}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
            {user.htmlUrl && (
              <a
                href={user.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                View on GitHub <LinkExternalIcon size={14} />
              </a>
            )}
            <div className={styles.settingsSection}>
              <h2 className={styles.settingsTitle}>Repository access</h2>
              <Link to="/enable-repos" className={styles.enableLink}>
                <RepoIcon size={18} />
                Enable Bit on repositories
              </Link>
            </div>
            {repos.length > 0 && (
              <div className={styles.repoList}>
                <h2 className={styles.repoListTitle}>Connected repositories</h2>
                <ul className={styles.repoListItems}>
                  {repos.map((repo) => (
                    <li key={repo.id}>
                      <Link
                        to="/$owner/$repo"
                        params={{ owner: repo.owner, repo: repo.name }}
                        search={{ selectedPrNumber: undefined }}
                        className={styles.repoLink}
                      >
                        <RepoIcon size={16} />
                        {repo.fullName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.signOut} onClick={() => void db.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
