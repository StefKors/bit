import { createFileRoute, Link, useSearch } from "@tanstack/react-router"
import { LinkExternalIcon, RepoIcon } from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { resolveUserAvatarUrl } from "@/lib/avatar"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { db } from "@/lib/instantDb"
import styles from "./index.module.css"

function HomePage() {
  const { user } = useAuth()
  const search = useSearch({ from: "/" })
  const githubConnected = search.github === "connected"
  const oauthError = search.error
  const oauthMessage = search.message

  const handleConnectGitHub = () => {
    if (!user?.id) return
    window.location.href = `/api/github/oauth/?userId=${user.id}`
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
            <p className={styles.sectionText}>GitHub connected as @{user.login}</p>
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
            <Link to="/enable-repos" className={styles.enableLink}>
              <RepoIcon size={18} />
              Enable Bit on repositories
            </Link>
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

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, string | number | boolean | null | undefined>) => ({
    github: search.github as string | undefined,
    error: search.error as string | undefined,
    message: search.message as string | undefined,
  }),
})
