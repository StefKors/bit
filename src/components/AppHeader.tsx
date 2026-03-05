import { useState, useRef } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { SignOutIcon, PaintbrushIcon } from "@primer/octicons-react"
import { useAuth } from "@/lib/hooks/UseAuth"
import { db } from "@/lib/InstantDb"
import { resolveUserAvatarUrl } from "@/lib/Avatar"
import { Avatar } from "./Avatar"
import { ThemeSettings } from "./ThemeSettings"
import { isDev } from "@/lib/utils/IsDevelopment"
import { isLight } from "@/lib/utils/CurrentColorScheme"
import styles from "./AppHeader.module.css"

export const AppHeader = () => {
  const { user } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const handleSignOut = () => {
    void db.auth.signOut()
    setUserMenuOpen(false)
  }

  const handleBackdropClick = () => {
    setUserMenuOpen(false)
  }

  const handleOpenThemeSettings = () => {
    setUserMenuOpen(false)
    setThemeSettingsOpen(true)
  }

  if (!user) return null

  const avatarUrl = resolveUserAvatarUrl(user)
  const pathSegments = pathname.split("/").filter(Boolean)
  const hasRepoContext =
    pathSegments.length >= 2 &&
    pathSegments[0] !== "api" &&
    pathSegments[0] !== "enable-repos" &&
    pathSegments[0] !== "__root__"
  const owner = hasRepoContext ? pathSegments[0] : null
  const repo = hasRepoContext ? pathSegments[1] : null

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.left}>
            <a href="/" className={styles.logo}>
              <img
                src={`/bit-cube-small${isLight() ? "-light" : ""}${isDev ? "-dev" : ""}.png`}
                alt="Bit"
                className={styles.logoImage}
              />
            </a>
            {owner && repo && (
              <nav className={styles.repoContext} aria-label="Repository context">
                <a
                  href={`https://github.com/${owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.repoContextLink}
                >
                  {owner}
                </a>
                <span className={styles.repoContextSeparator}>/</span>
                <Link
                  to="/$owner/$repo"
                  params={{ owner, repo }}
                  search={{ selectedPrNumber: undefined }}
                  className={styles.repoContextLink}
                >
                  {repo}
                </Link>
              </nav>
            )}
          </div>

          <div className={styles.right}>
            <div className={styles.userMenuContainer} ref={userMenuRef}>
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => {
                  setUserMenuOpen((prev) => !prev)
                }}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <Avatar src={avatarUrl} name={user.name || user.login} size={24} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className={styles.backdrop}
                    onClick={handleBackdropClick}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setUserMenuOpen(false)
                    }}
                    role="presentation"
                  />
                  <div className={styles.userMenu} role="menu" aria-label="User menu">
                    <div className={styles.userMenuHeader}>
                      <Avatar src={avatarUrl} name={user.name || user.login} size={40} />
                      <div className={styles.userInfo}>
                        {user.name && <span className={styles.userName}>{user.name}</span>}
                        {user.login && <span className={styles.userLogin}>@{user.login}</span>}
                      </div>
                    </div>
                    <div className={styles.userMenuDivider} />
                    <div className={styles.userMenuItems}>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.userMenuItem}
                        onClick={handleOpenThemeSettings}
                      >
                        <PaintbrushIcon size={16} />
                        <span>Appearance</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.userMenuItem}
                        onClick={handleSignOut}
                      >
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

      {themeSettingsOpen && (
        <ThemeSettings
          onClose={() => {
            setThemeSettingsOpen(false)
          }}
        />
      )}
    </>
  )
}
