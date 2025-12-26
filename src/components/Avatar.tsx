import { OrganizationIcon, PersonIcon } from "@primer/octicons-react"
import styles from "./Avatar.module.css"
import { useState } from "react"

interface AvatarFallbackProps {
  isOrganization?: boolean | null
  initials?: string | null
}

const AvatarFallback = ({ isOrganization, initials }: AvatarFallbackProps) => {
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
  const [hasError, sethasError] = useState(false)

  return (
    <div className={styles.avatarContainer} style={{ width: `${size}px`, height: `${size}px` }}>
      {src && !hasError ? (
        <img
          src={src}
          onError={() => {
            sethasError(true)
          }}
          alt={name ?? undefined}
          className={styles.avatar}
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      ) : (
        <div
          className={styles.avatarPlaceholder}
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          {<AvatarFallback initials={initial} isOrganization={isOrganization} />}
        </div>
      )}
      {isOnline && <div className={styles.onlineIndicator} />}
    </div>
  )
}
