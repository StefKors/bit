import { authClient } from "@/lib/auth"
import styles from "./HomePage.module.css"

interface HomePageProps {
  onLogout: () => void
}

export function HomePage({ onLogout }: HomePageProps) {
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    onLogout()
  }

  if (!session) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.avatarContainer}>
            {session.user.image ? (
              <img src={session.user.image} alt={session.user.name} className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {session.user.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <div className={styles.onlineIndicator} />
          </div>
          <h1 className={styles.title}>Welcome, {session.user.name}</h1>
          <p className={styles.subtitle}>{session.user.email}</p>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>You're signed in with GitHub.</p>
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
