import * as React from "react"
import { Menu } from "@base-ui/react/menu"
import { ChevronDownIcon, SortAscIcon, SortDescIcon, FilterIcon, XIcon } from "@primer/octicons-react"
import styles from "./PRFiltersBar.module.css"

export type PRStatus = "all" | "open" | "closed" | "merged"
export type PRDraftFilter = "all" | "draft" | "ready"
export type PRSortField = "updated" | "created" | "comments" | "title" | "author"
export type PRSortDirection = "desc" | "asc"

export interface PRFilters {
  status: PRStatus
  author: string | null
  labels: string[]
  draft: PRDraftFilter
  sortBy: PRSortField
  sortDirection: PRSortDirection
}

interface PRFiltersBarProps {
  filters: PRFilters
  onFiltersChange: (filters: PRFilters) => void
  authors: string[]
  labels: string[]
}

const STATUS_OPTIONS: { value: PRStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
]

const DRAFT_OPTIONS: { value: PRDraftFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready for review" },
]

const SORT_OPTIONS: { value: PRSortField; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Newest" },
  { value: "comments", label: "Most comments" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
]

export function PRFiltersBar({ filters, onFiltersChange, authors, labels }: PRFiltersBarProps) {
  const updateFilter = <K extends keyof PRFilters>(key: K, value: PRFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({
      status: "all",
      author: null,
      labels: [],
      draft: "all",
      sortBy: "updated",
      sortDirection: "desc",
    })
  }

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.author !== null ||
    filters.labels.length > 0 ||
    filters.draft !== "all"

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

        {/* Status Filter */}
        <FilterDropdown
          label="Status"
          value={STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? "All"}
          isActive={filters.status !== "all"}
        >
          {STATUS_OPTIONS.map((option) => (
            <Menu.Item
              key={option.value}
              className={styles.menuItem}
              data-selected={filters.status === option.value || undefined}
              onSelect={() => updateFilter("status", option.value)}
            >
              {option.label}
            </Menu.Item>
          ))}
        </FilterDropdown>

        {/* Author Filter */}
        {authors.length > 0 && (
          <FilterDropdown
            label="Author"
            value={filters.author ?? "Any"}
            isActive={filters.author !== null}
          >
            <Menu.Item
              className={styles.menuItem}
              data-selected={filters.author === null || undefined}
              onSelect={() => updateFilter("author", null)}
            >
              Any
            </Menu.Item>
            <Menu.Separator className={styles.menuSeparator} />
            {authors.map((author) => (
              <Menu.Item
                key={author}
                className={styles.menuItem}
                data-selected={filters.author === author || undefined}
                onSelect={() => updateFilter("author", author)}
              >
                {author}
              </Menu.Item>
            ))}
          </FilterDropdown>
        )}

        {/* Labels Filter */}
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

        {/* Draft Filter */}
        <FilterDropdown
          label="Type"
          value={DRAFT_OPTIONS.find((o) => o.value === filters.draft)?.label ?? "All"}
          isActive={filters.draft !== "all"}
        >
          {DRAFT_OPTIONS.map((option) => (
            <Menu.Item
              key={option.value}
              className={styles.menuItem}
              data-selected={filters.draft === option.value || undefined}
              onSelect={() => updateFilter("draft", option.value)}
            >
              {option.label}
            </Menu.Item>
          ))}
        </FilterDropdown>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button className={styles.clearButton} onClick={clearFilters} title="Clear all filters">
            <XIcon size={14} />
            Clear
          </button>
        )}
      </div>

      <div className={styles.sortGroup}>
        {/* Sort Field */}
        <FilterDropdown
          label="Sort"
          value={SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? "Recently updated"}
          isActive={false}
        >
          {SORT_OPTIONS.map((option) => (
            <Menu.Item
              key={option.value}
              className={styles.menuItem}
              data-selected={filters.sortBy === option.value || undefined}
              onSelect={() => updateFilter("sortBy", option.value)}
            >
              {option.label}
            </Menu.Item>
          ))}
        </FilterDropdown>

        {/* Sort Direction */}
        <button
          className={styles.sortDirectionButton}
          onClick={toggleSortDirection}
          title={filters.sortDirection === "desc" ? "Sort descending" : "Sort ascending"}
        >
          {filters.sortDirection === "desc" ? <SortDescIcon size={16} /> : <SortAscIcon size={16} />}
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

function FilterDropdown({ label, value, isActive, children }: FilterDropdownProps) {
  return (
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
}
