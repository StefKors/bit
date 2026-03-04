import { Avatar } from "./Avatar"
import { resolveOwnerAvatarUrl } from "@/lib/avatar"
import styles from "./AuthorLabel.module.css"

interface AuthorLabelProps {
  login: string
  avatarUrl?: string | null
  size?: number
}

export const AuthorLabel = ({ login, avatarUrl, size = 14 }: AuthorLabelProps) => {
  const resolvedUrl = resolveOwnerAvatarUrl(login, avatarUrl)

  return (
    <span className={styles.authorLabel}>
      <Avatar src={resolvedUrl} name={login} size={size} />
      <span className={styles.authorLogin}>{login}</span>
    </span>
  )
}
