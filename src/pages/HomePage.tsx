import { SignOutIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
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
