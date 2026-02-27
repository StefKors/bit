import { Menu } from "@base-ui/react/menu"
import {
  ChevronDownIcon,
  SortAscIcon,
  SortDescIcon,
  FilterIcon,
  XIcon,
} from "@primer/octicons-react"
import {
  type IssueFilters,
  type Author,
  DEFAULT_ISSUE_FILTERS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/issue-filters"
import { Avatar } from "@/components/Avatar"
import styles from "./IssueFiltersBar.module.css"

export interface IssueFiltersBarProps {
  filters: IssueFilters
  onFiltersChange: (filters: IssueFilters) => void
  authors: Author[]
  labels: string[]
  hasActiveFilters: boolean
}

export const IssueFiltersBar = ({
  filters,
  onFiltersChange,
  authors,
  labels,
  hasActiveFilters,
}: IssueFiltersBarProps) => {
  const updateFilter = <K extends keyof IssueFilters>(key: K, value: IssueFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(DEFAULT_ISSUE_FILTERS)
  }

  const toggleLabel = (label: string) => {
    const newLabels = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label]
    updateFilter("labels", newLabels)
  }

  const toggleSortDirection = () => {
    updateFilter("sortDirection", filters.sortDirection === "desc" ? "asc" : "desc")
  }

  return (
    <div className={styles.filtersBar}>
      <div className={styles.filtersGroup}>
        <FilterIcon size={16} className={styles.filterIcon} />

        <FilterDropdown
          label="Status"
          value={STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? "All"}
          isActive={filters.status !== "all"}
        >
          {STATUS_OPTIONS.map((option) => (
            <FilterMenuItem
              key={option.value}
              selected={filters.status === option.value}
              onClick={() => {
                updateFilter("status", option.value)
              }}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>

        {authors.length > 0 && (
          <FilterDropdown
            label="Author"
            value={filters.author ?? "Any"}
            isActive={filters.author !== null}
          >
            <FilterMenuItem
              selected={filters.author === null}
              onClick={() => {
                updateFilter("author", null)
              }}
            >
              Any
            </FilterMenuItem>
            <Menu.Separator className={styles.menuSeparator} />
            {authors.map((author) => (
              <FilterMenuItem
                key={author.login}
                selected={filters.author === author.login}
                onClick={() => {
                  updateFilter("author", author.login)
                }}
              >
                <Avatar src={author.avatarUrl} name={author.login} size={16} />
                {author.login}
              </FilterMenuItem>
            ))}
          </FilterDropdown>
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
                onCheckedChange={() => {
                  toggleLabel(label)
                }}
              >
                <Menu.CheckboxItemIndicator className={styles.checkIndicator}>
                  ✓
                </Menu.CheckboxItemIndicator>
                {label}
              </Menu.CheckboxItem>
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
