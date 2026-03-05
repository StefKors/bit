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
  const sizeStyle = { width: `${size}px`, height: `${size}px` }

  return (
    <div className={styles.avatarContainer} style={sizeStyle}>
      <BaseAvatar.Root className={styles.avatarRoot} style={sizeStyle}>
        {src ? (
          <BaseAvatar.Image
            src={src}
            alt={name ?? undefined}
            className={styles.avatar}
            style={sizeStyle}
          />
        ) : null}
        <BaseAvatar.Fallback className={styles.avatarPlaceholder} style={sizeStyle}>
          <AvatarFallbackContent initials={initial} isOrganization={isOrganization} />
        </BaseAvatar.Fallback>
      </BaseAvatar.Root>
      {Boolean(isOnline) && <div className={styles.onlineIndicator} />}
    </div>
  )
}
