import { useRef } from "react"
import { Menu } from "@base-ui/react/menu"
import {
  ChevronDownIcon,
  SortAscIcon,
  SortDescIcon,
  SearchIcon,
  XIcon,
} from "@primer/octicons-react"
import {
  type RepoFilters,
  DEFAULT_REPO_FILTERS,
  TYPE_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/repo-filters"
import styles from "./RepoFiltersBar.module.css"

export type RepoFiltersBarProps = {
  filters: RepoFilters
  onFiltersChange: (filters: RepoFilters) => void
  languages: string[]
  hasActiveFilters: boolean
  totalCount: number
  filteredCount: number
}

export const RepoFiltersBar = ({
  filters,
  onFiltersChange,
  languages,
  hasActiveFilters,
  totalCount,
  filteredCount,
}: RepoFiltersBarProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null)

  const updateFilter = <K extends keyof RepoFilters>(key: K, value: RepoFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(DEFAULT_REPO_FILTERS)
    if (searchInputRef.current) {
      searchInputRef.current.value = ""
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilter("search", e.target.value)
  }

  const toggleSortDirection = () => {
    updateFilter("sortDirection", filters.sortDirection === "desc" ? "asc" : "desc")
  }

  return (
    <div className={styles.filtersBar}>
      <div className={styles.searchWrapper}>
        <SearchIcon size={16} className={styles.searchIcon} />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Find a repository..."
          defaultValue={filters.search}
          onChange={handleSearchChange}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.filtersGroup}>
        <FilterDropdown
          label="Type"
          value={TYPE_OPTIONS.find((o) => o.value === filters.type)?.label ?? "All"}
          isActive={filters.type !== "all"}
        >
          {TYPE_OPTIONS.map((option) => (
            <FilterMenuItem
              key={option.value}
              selected={filters.type === option.value}
              onClick={() => {
                updateFilter("type", option.value)
              }}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>

        {languages.length > 0 && (
          <FilterDropdown
            label="Language"
            value={filters.language ?? "Any"}
            isActive={filters.language !== null}
          >
            <FilterMenuItem
              selected={filters.language === null}
              onClick={() => {
                updateFilter("language", null)
              }}
            >
              Any
            </FilterMenuItem>
            <Menu.Separator className={styles.menuSeparator} />
            {languages.map((language) => (
              <FilterMenuItem
                key={language}
                selected={filters.language === language}
                onClick={() => {
                  updateFilter("language", language)
                }}
              >
                <LanguageDot language={language} />
                {language}
              </FilterMenuItem>
            ))}
          </FilterDropdown>
        )}

        {hasActiveFilters && (
          <button className={styles.clearButton} onClick={clearFilters} title="Clear all filters">
            <XIcon size={14} />
            Clear
          </button>
        )}
      </div>

      <div className={styles.sortGroup}>
        {filteredCount !== totalCount && (
          <span className={styles.resultsCount}>
            {filteredCount} of {totalCount}
          </span>
        )}

        <FilterDropdown
          label="Sort"
          value={SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? "Recently updated"}
          isActive={false}
        >
          {SORT_OPTIONS.map((option) => (
            <FilterMenuItem
              key={option.value}
              selected={filters.sortBy === option.value}
              onClick={() => {
                updateFilter("sortBy", option.value)
              }}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>

        <button
          className={styles.sortDirectionButton}
          onClick={toggleSortDirection}
          title={filters.sortDirection === "desc" ? "Sort descending" : "Sort ascending"}
        >
          {filters.sortDirection === "desc" ? (
            <SortDescIcon size={16} />
          ) : (
            <SortAscIcon size={16} />
          )}
        </button>
      </div>
    </div>
  )
}

type FilterDropdownProps = {
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

type FilterMenuItemProps = {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}

const FilterMenuItem = ({ selected, onClick, children }: FilterMenuItemProps) => (
  <Menu.Item className={styles.menuItem} data-selected={selected || undefined} onClick={onClick}>
    {children}
  </Menu.Item>
)

// Language colors for common languages
const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  PHP: "#4F5D95",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
}

const LanguageDot = ({ language }: { language: string }) => (
  <span
    className={styles.languageDot}
    style={{ backgroundColor: languageColors[language] || "#8b949e" }}
  />
)
