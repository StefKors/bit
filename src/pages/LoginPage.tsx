import { SignOutIcon, MarkGithubIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { Button } from "@/components/Button"
import { CommitInfo } from "@/components/CommitInfo"
import { Avatar } from "@/components/Avatar"
import styles from "./LoginPage.module.css"

function LoginPage() {
  const { isLoading, user, error } = db.useAuth()

  const handleGitHubSignIn = () => {
    // InstantDB GitHub OAuth with required scopes
    const url = db.auth.createAuthorizationURL({
      clientName: "bit",
      // Pass custom scopes for GitHub integration
      redirectURL: window.location.origin + "/",
    })
    window.location.href = url
  }

  const handleSignOut = () => {
    db.auth.signOut()
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading...</span>
          </div>
        </div>
        <CommitInfo />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/bit-cube.png" alt="Bit" className={styles.logo} />
            <h1 className={styles.title}>Authentication Error</h1>
            <p className={styles.subtitle}>{error.message}</p>
          </div>

          <Button
            variant="primary"
            size="large"
            block
            leadingIcon={<MarkGithubIcon size={20} />}
            onClick={handleGitHubSignIn}
          >
            Try again with GitHub
          </Button>
        </div>
        <CommitInfo />
      </div>
    )
  }

  if (user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Avatar src={undefined} name={user.email} size={80} isOnline />
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>{user.email}</p>
          </div>

          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user.email}</span>
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
        <CommitInfo />
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
          <p className={styles.footerText}>By continuing, you agree to our terms of service</p>
        </div>
      </div>
      <CommitInfo />
    </div>
  )
}

export default LoginPage
