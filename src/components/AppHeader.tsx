import { useState, useRef } from "react"
import { Link, useMatches } from "@tanstack/react-router"
import { SearchIcon, SignOutIcon, GearIcon, PersonIcon } from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from "@/lib/instantDb"
import { Avatar } from "./Avatar"
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb"
import { isDev } from "@/lib/utils/isDevelopment"
import { isLight } from "@/lib/utils/currentColorScheme"
import styles from "./AppHeader.module.css"

type OpenCommandMenuFn = () => void

interface AppHeaderProps {
  onOpenCommandMenu?: OpenCommandMenuFn
}

export const AppHeader = ({ onOpenCommandMenu }: AppHeaderProps) => {
  const { user } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const matches = useMatches()

  // Build breadcrumb from route matches
  const breadcrumbItems = buildBreadcrumbFromMatches(matches)

  const handleSignOut = () => {
    db.auth.signOut()
    setUserMenuOpen(false)
  }

  // Close menu when clicking outside
  const handleBackdropClick = () => {
    setUserMenuOpen(false)
  }

  if (!user) return null

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.left}>
          <Link
            to="/"
            search={{ github: undefined, error: undefined, message: undefined }}
            className={styles.logo}
          >
            <img
              src={`/bit-cube-small${isLight() ? "-light" : ""}${isDev ? "-dev" : ""}.png`}
              alt="Bit"
              className={styles.logoImage}
            />
          </Link>

          {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} variant="compact" />}
        </div>

        <div className={styles.right}>
          <button
            type="button"
            className={styles.searchButton}
            onClick={onOpenCommandMenu}
            aria-label="Search"
          >
            <SearchIcon size={14} />
            <span className={styles.searchText}>Search</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>

          <div className={styles.userMenuContainer} ref={userMenuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              <Avatar src={user.avatarUrl} name={user.name || user.login} size={24} />
            </button>

            {userMenuOpen && (
              <>
                <div className={styles.backdrop} onClick={handleBackdropClick} />
                <div className={styles.userMenu}>
                  <div className={styles.userMenuHeader}>
                    <Avatar src={user.avatarUrl} name={user.name || user.login} size={40} />
                    <div className={styles.userInfo}>
                      {user.name && <span className={styles.userName}>{user.name}</span>}
                      {user.login && <span className={styles.userLogin}>@{user.login}</span>}
                    </div>
                  </div>
                  <div className={styles.userMenuDivider} />
                  <div className={styles.userMenuItems}>
                    <button type="button" className={styles.userMenuItem}>
                      <PersonIcon size={16} />
                      <span>Profile</span>
                    </button>
                    <button type="button" className={styles.userMenuItem}>
                      <GearIcon size={16} />
                      <span>Settings</span>
                    </button>
                    <div className={styles.userMenuDivider} />
                    <button type="button" className={styles.userMenuItem} onClick={handleSignOut}>
                      <SignOutIcon size={16} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// Helper to build breadcrumb from route matches
const buildBreadcrumbFromMatches = (matches: ReturnType<typeof useMatches>): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = []

  for (const match of matches) {
    const routeId = match.routeId

    // Skip root and index routes
    if (routeId === "__root__" || routeId === "/") continue

    const params = match.params as Record<string, string>

    // Handle dynamic routes
    if (routeId === "/$owner") {
      items.push({
        label: params.owner,
        to: "/$owner",
        params: { owner: params.owner },
      })
    } else if (routeId === "/$owner/$repo") {
      items.push({
        label: params.repo,
        to: "/$owner/$repo",
        params: { owner: params.owner, repo: params.repo },
      })
    } else if (routeId === "/$owner/$repo/pulls") {
      items.push({ label: "Pull Requests" })
    } else if (routeId === "/$owner/$repo/pull/$number") {
      items.push({
        label: "Pull Requests",
        to: "/$owner/$repo/pulls",
        params: { owner: params.owner, repo: params.repo },
      })
      items.push({ label: `#${params.number}` })
    } else if (routeId === "/$owner/$repo/issues") {
      items.push({ label: "Issues" })
    } else if (routeId === "/$owner/$repo/issues/$number") {
      items.push({
        label: "Issues",
        to: "/$owner/$repo/issues",
        params: { owner: params.owner, repo: params.repo },
      })
      items.push({ label: `#${params.number}` })
    }
  }

  return items
}
