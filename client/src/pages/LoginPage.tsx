import { SignOutIcon, MarkGithubIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
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

          <Button
            variant="danger"
            size="large"
            block
            leadingIcon={<SignOutIcon size={16} />}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
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

        <Button
          variant="primary"
          size="large"
          block
          leadingIcon={<MarkGithubIcon size={20} />}
          onClick={handleGitHubSignIn}
        >
          Continue with GitHub
        </Button>

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
