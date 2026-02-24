import { Menu } from "@base-ui/react/menu"
import { useMemo, useState } from "react"
import {
  ChevronDownIcon,
  SortAscIcon,
  SortDescIcon,
  FilterIcon,
  XIcon,
} from "@primer/octicons-react"
import {
  type PRFilters,
  type Author,
  DEFAULT_PR_FILTERS,
  STATUS_OPTIONS,
  DRAFT_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/pr-filters"
import { Avatar } from "@/components/Avatar"
import styles from "./PRFiltersBar.module.css"

export interface PRFiltersBarProps {
  filters: PRFilters
  onFiltersChange: (filters: PRFilters) => void
  authors: Author[]
  labels: string[]
  hasActiveFilters: boolean
  currentUserLogin?: string | null
}

export const PRFiltersBar = ({
  filters,
  onFiltersChange,
  authors,
  labels,
  hasActiveFilters,
  currentUserLogin,
}: PRFiltersBarProps) => {
  const [authorSearch, setAuthorSearch] = useState("")

  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.value === filters.sortBy)?.label ?? "Recently updated"
  const currentSortDirectionLabel = filters.sortDirection === "desc" ? "Descending" : "Ascending"

  const updateFilter = <K extends keyof PRFilters>(key: K, value: PRFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(DEFAULT_PR_FILTERS)
  }

  const toggleLabel = (label: string) => {
    const newLabels = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label]
    updateFilter("labels", newLabels)
  }

  const filteredAuthors = useMemo(() => {
    const search = authorSearch.trim().toLowerCase()
    const matchingAuthors = search
      ? authors.filter((author) => author.login.toLowerCase().includes(search))
      : authors

    return [...matchingAuthors].sort((a, b) => {
      if (a.login === filters.author && b.login !== filters.author) return -1
      if (a.login !== filters.author && b.login === filters.author) return 1

      if (currentUserLogin) {
        if (a.login === currentUserLogin && b.login !== currentUserLogin) return -1
        if (a.login !== currentUserLogin && b.login === currentUserLogin) return 1
      }

      return a.login.localeCompare(b.login)
    })
  }, [authors, authorSearch, currentUserLogin, filters.author])

  const setSortField = (sortBy: PRFilters["sortBy"]) => {
    updateFilter("sortBy", sortBy)
  }

  return (
    <div className={styles.filtersBar}>
      <div className={styles.filtersGroup}>
        <button
          type="button"
          className={`${styles.filterIconButton} ${hasActiveFilters ? styles.filterIconButtonActive : ""}`}
          onClick={hasActiveFilters ? clearFilters : undefined}
          title={hasActiveFilters ? "Clear all filters" : "Filters"}
          aria-label={hasActiveFilters ? "Clear all filters" : "Filters"}
        >
          {hasActiveFilters ? <XIcon size={14} /> : <FilterIcon size={16} />}
        </button>

        <FilterDropdown
          label="Status"
          value={STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? "All"}
          isActive={filters.status !== "all"}
        >
          {STATUS_OPTIONS.map((option) => (
            <FilterMenuItem
              key={option.value}
              selected={filters.status === option.value}
              onClick={() => updateFilter("status", option.value)}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>

        {authors.length > 0 && (
          <Menu.Root>
            <Menu.Trigger
              className={`${styles.filterTrigger} ${filters.author !== null ? styles.filterActive : ""}`}
            >
              <span className={styles.filterLabel}>Author:</span>
              <span className={styles.filterValue}>{filters.author ?? "All"}</span>
              <ChevronDownIcon size={12} className={styles.chevron} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className={styles.menuPositioner} sideOffset={4}>
                <Menu.Popup className={styles.menuPopupLarge}>
                  <div className={styles.authorSearchRow}>
                    <input
                      type="text"
                      value={authorSearch}
                      onChange={(event) => setAuthorSearch(event.target.value)}
                      placeholder="Assign to..."
                      className={styles.authorSearchInput}
                    />
                  </div>
                  {filteredAuthors.length === 0 ? (
                    <div className={styles.emptyMenuState}>No matching authors</div>
                  ) : (
                    filteredAuthors.map((author) => (
                      <FilterMenuItem
                        key={author.login}
                        selected={filters.author === author.login}
                        onClick={() =>
                          updateFilter(
                            "author",
                            filters.author === author.login ? null : author.login,
                          )
                        }
                      >
                        <Avatar src={author.avatarUrl} name={author.login} size={16} />
                        {author.login}
                      </FilterMenuItem>
                    ))
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}

        {labels.length > 0 && (
          <FilterDropdown
            label="Labels"
            value={filters.labels.length > 0 ? `${filters.labels.length} selected` : "Any"}
            isActive={filters.labels.length > 0}
          >
            {labels.map((label) => (
              <Menu.CheckboxItem
                key={label}
                className={styles.menuItem}
                checked={filters.labels.includes(label)}
                onCheckedChange={() => toggleLabel(label)}
              >
                <Menu.CheckboxItemIndicator className={styles.checkIndicator}>
                  ✓
                </Menu.CheckboxItemIndicator>
                {label}
              </Menu.CheckboxItem>
            ))}
          </FilterDropdown>
        )}

        <FilterDropdown
          label="Type"
          value={DRAFT_OPTIONS.find((o) => o.value === filters.draft)?.label ?? "All"}
          isActive={filters.draft !== "all"}
        >
          {DRAFT_OPTIONS.map((option) => (
            <FilterMenuItem
              key={option.value}
              selected={filters.draft === option.value}
              onClick={() => updateFilter("draft", option.value)}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>
      </div>

      <div className={styles.sortGroup}>
        <Menu.Root>
          <Menu.Trigger
            className={styles.sortFieldButton}
            title={`Sort by: ${currentSortLabel} (${currentSortDirectionLabel})`}
            aria-label={`Sort by: ${currentSortLabel} (${currentSortDirectionLabel})`}
          >
            {filters.sortDirection === "desc" ? (
              <SortDescIcon size={15} className={styles.sortFieldIcon} />
            ) : (
              <SortAscIcon size={15} className={styles.sortFieldIcon} />
            )}
            <ChevronDownIcon size={12} className={styles.sortFieldChevron} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className={styles.menuPositioner} sideOffset={4}>
              <Menu.Popup className={styles.menuPopup}>
                {SORT_OPTIONS.map((option) => (
                  <FilterMenuItem
                    key={option.value}
                    selected={filters.sortBy === option.value}
                    onClick={() => setSortField(option.value)}
                  >
                    {option.label}
                  </FilterMenuItem>
                ))}
                <Menu.Separator className={styles.menuSeparator} />
                <FilterMenuItem
                  selected={filters.sortDirection === "desc"}
                  onClick={() => updateFilter("sortDirection", "desc")}
                >
                  Descending
                </FilterMenuItem>
                <FilterMenuItem
                  selected={filters.sortDirection === "asc"}
                  onClick={() => updateFilter("sortDirection", "asc")}
                >
                  Ascending
                </FilterMenuItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  )
}

interface FilterDropdownProps {
  label: string
  value: string
  isActive: boolean
  children: React.ReactNode
}

const FilterDropdown = ({ label, value, isActive, children }: FilterDropdownProps) => (
  <Menu.Root>
    <Menu.Trigger className={`${styles.filterTrigger} ${isActive ? styles.filterActive : ""}`}>
      <span className={styles.filterLabel}>{label}:</span>
      <span className={styles.filterValue}>{value}</span>
      <ChevronDownIcon size={12} className={styles.chevron} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner className={styles.menuPositioner} sideOffset={4}>
        <Menu.Popup className={styles.menuPopup}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
)

interface FilterMenuItemProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}

const FilterMenuItem = ({ selected, onClick, children }: FilterMenuItemProps) => (
  <Menu.Item className={styles.menuItem} data-selected={selected || undefined} onClick={onClick}>
    {children}
  </Menu.Item>
)
