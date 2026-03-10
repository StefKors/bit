import { Avatar } from "./Avatar"
import { resolveOwnerAvatarUrl } from "@/lib/Avatar"
import styles from "./AuthorLabel.module.css"

interface AuthorLabelProps {
  login: string
  avatarUrl?: string | null
  size?: number
  weight?: "regular" | "bold"
  lineHeight?: "meta" | "default"
  actorType?: "bot" | "ai"
}

export const AuthorLabel = ({
  login,
  avatarUrl,
  size = 13,
  weight = "bold",
  lineHeight = "meta",
  actorType,
}: AuthorLabelProps) => {
  const normalizedLogin = login.toLowerCase()
  const isAiByLogin =
    normalizedLogin === "copilot-pull-request-reviewer[bot]" ||
    normalizedLogin.includes("copilot") ||
    normalizedLogin.includes("ai-reviewer")
  const resolvedActorType =
    actorType ?? (isAiByLogin ? "ai" : login.endsWith("[bot]") ? "bot" : null)
  const isAi = resolvedActorType === "ai"
  const isBot = resolvedActorType === "bot"
  const displayName = isBot ? login.slice(0, -5) : login
  const resolvedUrl = resolveOwnerAvatarUrl(login, avatarUrl)
  const avatarSize = Math.round(size + size * 0.4)

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
      <Avatar src={resolvedUrl} name={login} size={avatarSize} />
      <span
        className={`${styles.authorLogin} ${weight === "regular" ? styles.authorLoginRegular : ""}`}
      >
        {displayName}
      </span>
      {isAi ? (
        <span className={styles.aiBadge}>AI</span>
      ) : isBot ? (
        <span className={styles.botBadge}>bot</span>
      ) : null}
    </span>
  )
}
