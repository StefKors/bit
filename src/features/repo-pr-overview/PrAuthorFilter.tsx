import { useState } from "react"
import { ChevronDownIcon } from "@primer/octicons-react"
import { AuthorLabel } from "@/components/AuthorLabel"
import styles from "./PrAuthorFilter.module.css"

type PrStateFilter = "all" | "open" | "draft" | "needsReview" | "readyToMerge" | "merged"

interface PrAuthorFilterProps {
  authorFilter: string
  stateFilter: PrStateFilter
  userLogin: string | null
  uniqueAuthors: string[]
  onFilterChange: (value: string) => void
  onStateFilterChange: (value: PrStateFilter) => void
}

export function PrAuthorFilter({
  authorFilter,
  stateFilter,
  userLogin,
  uniqueAuthors,
  onFilterChange,
  onStateFilterChange,
}: PrAuthorFilterProps) {
  const [authorOpen, setAuthorOpen] = useState(false)
  const [stateOpen, setStateOpen] = useState(false)

  const isSpecificAuthor = authorFilter !== "all" && authorFilter !== "me"
  const displayLogin =
    authorFilter === "me" && userLogin ? userLogin : isSpecificAuthor ? authorFilter : null
  const stateLabel: Record<PrStateFilter, string> = {
    all: "All states",
    open: "Open",
    draft: "Draft",
    needsReview: "Needs review",
    readyToMerge: "Ready",
    merged: "Merged",
  }

  return (
    <div className={styles.authorFilter}>
      <div className={styles.filtersRow}>
        <div className={styles.authorDropdownWrap}>
          <button
            type="button"
            className={`${styles.authorPill} ${authorFilter !== "all" ? styles.authorPillActive : ""}`}
            onClick={() => {
              setAuthorOpen((prev) => !prev)
            }}
            aria-expanded={authorOpen}
          >
            {displayLogin ? <AuthorLabel login={displayLogin} size={12} /> : "All authors"}
            <ChevronDownIcon size={10} />
          </button>
          {authorOpen && (
            <div className={styles.authorDropdown}>
              {userLogin && (
                <button
                  type="button"
                  className={`${styles.authorDropdownItem} ${authorFilter === "me" ? styles.authorDropdownItemActive : ""}`}
                  onClick={() => {
                    onFilterChange("me")
                    setAuthorOpen(false)
                  }}
                >
                  <AuthorLabel login={userLogin} size={14} />
                </button>
              )}
              <button
                type="button"
                className={`${styles.authorDropdownItem} ${authorFilter === "all" ? styles.authorDropdownItemActive : ""}`}
                onClick={() => {
                  onFilterChange("all")
                  setAuthorOpen(false)
                }}
              >
                All authors
              </button>
              {uniqueAuthors.map((login) => (
                <button
                  key={login}
                  type="button"
                  className={`${styles.authorDropdownItem} ${authorFilter === login ? styles.authorDropdownItemActive : ""}`}
                  onClick={() => {
                    onFilterChange(login)
                    setAuthorOpen(false)
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
        <div className={styles.stateDropdownWrap}>
          <button
            type="button"
            className={`${styles.authorPill} ${stateFilter !== "all" ? styles.authorPillActive : ""}`}
            onClick={() => {
              setStateOpen((prev) => !prev)
            }}
            aria-expanded={stateOpen}
          >
            {stateLabel[stateFilter]} <ChevronDownIcon size={10} />
          </button>
          {stateOpen && (
            <div className={styles.authorDropdown}>
              {(Object.keys(stateLabel) as PrStateFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.authorDropdownItem} ${stateFilter === value ? styles.authorDropdownItemActive : ""}`}
                  onClick={() => {
                    onStateFilterChange(value)
                    setStateOpen(false)
                  }}
                >
                  {stateLabel[value]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
