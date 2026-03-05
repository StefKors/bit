import { Avatar } from "./Avatar"
import { resolveOwnerAvatarUrl } from "@/lib/Avatar"
import styles from "./AuthorLabel.module.css"

interface AuthorLabelProps {
  login: string
  avatarUrl?: string | null
  size?: number
  weight?: "regular" | "bold"
}

export const AuthorLabel = ({ login, avatarUrl, size = 13, weight = "bold" }: AuthorLabelProps) => {
  const isBot = login.endsWith("[bot]")
  const displayName = isBot ? login.slice(0, -5) : login
  const resolvedUrl = resolveOwnerAvatarUrl(login, avatarUrl)
  const avatarSize = Math.max(size, 14)

  return (
    <span
      className={styles.authorLabel}
      style={{ "--author-label-size": `${size}px` } as React.CSSProperties}
    >
      <span className={styles.authorAvatar}>
        <Avatar src={resolvedUrl} name={login} size={avatarSize} />
      </span>
      <span
        className={`${styles.authorLogin} ${weight === "regular" ? styles.authorLoginRegular : ""}`}
      >
        {displayName}
      </span>
      {isBot && <span className={styles.botBadge}>bot</span>}
    </span>
  )
}
