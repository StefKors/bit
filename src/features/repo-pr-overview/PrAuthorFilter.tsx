import { useState } from "react"
import { ChevronDownIcon } from "@primer/octicons-react"
import { AuthorLabel } from "@/components/AuthorLabel"
import styles from "./PrAuthorFilter.module.css"

interface PrAuthorFilterProps {
  authorFilter: string
  userLogin: string | null
  uniqueAuthors: string[]
  onFilterChange: (value: string) => void
}

export function PrAuthorFilter({
  authorFilter,
  userLogin,
  uniqueAuthors,
  onFilterChange,
}: PrAuthorFilterProps) {
  const [open, setOpen] = useState(false)

  const isSpecificAuthor = authorFilter !== "all" && authorFilter !== "me"
  const displayLogin = isSpecificAuthor ? authorFilter : null

  return (
    <div className={styles.authorFilter}>
      <div className={styles.authorFilterPills}>
        <button
          type="button"
          className={`${styles.authorPill} ${authorFilter === "all" ? styles.authorPillActive : ""}`}
          onClick={() => {
            onFilterChange("all")
          }}
        >
          All
        </button>
        {userLogin && (
          <button
            type="button"
            className={`${styles.authorPill} ${authorFilter === "me" ? styles.authorPillActive : ""}`}
            onClick={() => {
              onFilterChange("me")
            }}
          >
            Mine
          </button>
        )}
        <div className={styles.authorDropdownWrap}>
          <button
            type="button"
            className={`${styles.authorPill} ${isSpecificAuthor ? styles.authorPillActive : ""}`}
            onClick={() => {
              setOpen((prev) => !prev)
            }}
            aria-expanded={open}
          >
            {displayLogin ? (
              <AuthorLabel login={displayLogin} size={12} />
            ) : (
              <>
                Author <ChevronDownIcon size={10} />
              </>
            )}
          </button>
          {open && (
            <div className={styles.authorDropdown}>
              {uniqueAuthors.map((login) => (
                <button
                  key={login}
                  type="button"
                  className={`${styles.authorDropdownItem} ${authorFilter === login ? styles.authorDropdownItemActive : ""}`}
                  onClick={() => {
                    onFilterChange(login)
                    setOpen(false)
                  }}
                >
                  <AuthorLabel login={login} size={14} />
                </button>
              ))}
              {uniqueAuthors.length === 0 && (
                <span className={styles.authorDropdownEmpty}>No authors</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
