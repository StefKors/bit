import { authClient } from "../lib/auth"
import styles from "./LoginPage.module.css"

interface LoginPageProps {
  onLogin?: () => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const { data: session, isPending } = authClient.useSession()

  const handleGitHubSignIn = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    })
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    onLogin?.()
  }

  if (isPending) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (session) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.avatarContainer}>
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {session.user.name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div className={styles.onlineIndicator} />
            </div>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>{session.user.name}</p>
          </div>

          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{session.user.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.statusBadge}>Authenticated</span>
            </div>
          </div>

          <button onClick={handleSignOut} className={styles.signOutButton}>
            <svg
              className={styles.buttonIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.backgroundPattern} />
      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/bit-cube.png" alt="Bit" className={styles.logo} />
          <h1 className={styles.title}>Sign in to Bit</h1>
          <p className={styles.subtitle}>Continue with your GitHub account</p>
        </div>

        <button onClick={handleGitHubSignIn} className={styles.githubButton}>
          <svg
            className={styles.buttonIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          Continue with GitHub
        </button>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            By continuing, you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
