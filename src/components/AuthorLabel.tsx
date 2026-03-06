import { Avatar } from "./Avatar"
import { resolveOwnerAvatarUrl } from "@/lib/Avatar"
import styles from "./AuthorLabel.module.css"

interface AuthorLabelProps {
  login: string
  avatarUrl?: string | null
  size?: number
  weight?: "regular" | "bold"
  lineHeight?: "meta" | "default"
}

export const AuthorLabel = ({
  login,
  avatarUrl,
  size = 13,
  weight = "bold",
  lineHeight = "meta",
}: AuthorLabelProps) => {
  const isBot = login.endsWith("[bot]")
  const displayName = isBot ? login.slice(0, -5) : login
  const resolvedUrl = resolveOwnerAvatarUrl(login, avatarUrl)

  return (
    <span
      className={styles.authorLabel}
      style={
        {
          "--author-label-size": `${size}px`,
          "--author-label-line-height":
            lineHeight === "default"
              ? "var(--bit-line-height-default)"
              : "var(--bit-line-height-meta)",
        } as React.CSSProperties
      }
    >
      <Avatar src={resolvedUrl} name={login} size={size + size * 0.4} />
      <span
        className={`${styles.authorLogin} ${weight === "regular" ? styles.authorLoginRegular : ""}`}
      >
        {displayName}
      </span>
      {isBot && <span className={styles.botBadge}>bot</span>}
    </span>
  )
}
