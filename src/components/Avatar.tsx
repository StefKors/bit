import { Avatar as BaseAvatar } from "@base-ui/react/avatar"
import { OrganizationIcon, PersonIcon } from "@primer/octicons-react"
import styles from "./Avatar.module.css"

interface AvatarFallbackContentProps {
  isOrganization?: boolean | null
  initials?: string | null
}

const AvatarFallbackContent = ({ isOrganization, initials }: AvatarFallbackContentProps) => {
  if (initials) {
    return <span>{initials}</span>
  }

  if (isOrganization) {
    return <OrganizationIcon className={styles.personIcon} />
  }

  return <PersonIcon className={styles.personIcon} />
}

interface AvatarProps {
  src?: string | null
  name?: string | null
  size: number
  isOnline?: boolean | null
  isOrganization?: boolean | null
}

export const Avatar = ({ size, src, name, isOnline, isOrganization }: AvatarProps) => {
  const initial = name?.charAt(0).toUpperCase()
  const borderWidth = Math.max(1, Math.round(size * 0.12))
  const placeholderFontSize = Math.max(9, Math.round(size * 0.42))
  const sizeStyle = {
    width: `${size}px`,
    height: `${size}px`,
    "--avatar-border-width": `${borderWidth}px`,
    "--avatar-placeholder-font-size": `${placeholderFontSize}px`,
  } as React.CSSProperties

  return (
    <BaseAvatar.Root className={styles.avatarContainer} style={sizeStyle}>
      {src ? (
        <BaseAvatar.Image
          src={src}
          alt={name ?? undefined}
          className={styles.avatar}
          width={size}
          height={size}
        />
      ) : null}
      <BaseAvatar.Fallback className={styles.avatarPlaceholder}>
        <AvatarFallbackContent initials={initial} isOrganization={isOrganization} />
      </BaseAvatar.Fallback>
      {Boolean(isOnline) && <div className={styles.onlineIndicator} />}
    </BaseAvatar.Root>
  )
}
