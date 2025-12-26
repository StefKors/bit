import { SignOutIcon } from "@primer/octicons-react"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/Button"
import styles from "./HomePage.module.css"
import { Avatar } from "@/components/Avatar"

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
          <Avatar
            src={session.user.image}
            name={session.user.name}
            size={80}
            isOnline
          />
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
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
