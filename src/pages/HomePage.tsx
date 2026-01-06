import { SignOutIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { Button } from "@/components/Button"
import styles from "./HomePage.module.css"
import { Avatar } from "@/components/Avatar"

interface HomePageProps {
  onLogout: () => void
}

export function HomePage({ onLogout }: HomePageProps) {
  const { user } = db.useAuth()

  const handleSignOut = async () => {
    await db.auth.signOut()
    onLogout()
  }

  if (!user) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Avatar src={undefined} name={user.email} size={80} isOnline />
          <h1 className={styles.title}>Welcome</h1>
          <p className={styles.subtitle}>{user.email}</p>
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
