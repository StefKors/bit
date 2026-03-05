import { Avatar } from "./Avatar"
import { resolveOwnerAvatarUrl } from "@/lib/Avatar"
import styles from "./AuthorLabel.module.css"

interface AuthorLabelProps {
  login: string
  avatarUrl?: string | null
  size?: number
}

export const AuthorLabel = ({ login, avatarUrl, size = 14 }: AuthorLabelProps) => {
  const isBot = login.endsWith("[bot]")
  const displayName = isBot ? login.slice(0, -5) : login
  const resolvedUrl = resolveOwnerAvatarUrl(login, avatarUrl)

  return (
    <span className={styles.authorLabel}>
      <Avatar src={resolvedUrl} name={login} size={size} />
      <span className={styles.authorLogin}>{displayName}</span>
      {isBot && <span className={styles.botBadge}>bot</span>}
    </span>
  )
}
