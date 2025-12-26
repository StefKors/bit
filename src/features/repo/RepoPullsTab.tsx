import { useState, useMemo } from "react"
import { Menu } from "@base-ui/react/menu"
import {
  GitPullRequestIcon,
  ChevronDownIcon,
  SortAscIcon,
  SortDescIcon,
  FilterIcon,
  XIcon,
} from "@primer/octicons-react"
import type { GithubPullRequest } from "@/db/schema"
import { PRListItem } from "@/features/pr/PRListItem"
import {
  type PRFilters,
  DEFAULT_PR_FILTERS,
  STATUS_OPTIONS,
  DRAFT_OPTIONS,
  SORT_OPTIONS,
  extractAuthors,
  extractLabels,
  applyFiltersAndSort,
} from "@/lib/pr-filters"
import styles from "./RepoPullsTab.module.css"

interface RepoPullsTabProps {
  prs: readonly GithubPullRequest[]
  fullName: string
}

export const RepoPullsTab = ({ prs, fullName }: RepoPullsTabProps) => {
  const [filters, setFilters] = useState<PRFilters>(DEFAULT_PR_FILTERS)

  // Compute derived data
  const authors = useMemo(() => extractAuthors(prs), [prs])
  const labels = useMemo(() => extractLabels(prs), [prs])
  const filteredPrs = useMemo(() => applyFiltersAndSort(prs, filters), [prs, filters])

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.author !== null ||
    filters.labels.length > 0 ||
    filters.draft !== "all"

  if (prs.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No pull requests</h3>
          <p className={styles.emptyText}>No pull requests have been synced yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.content}>
      <FiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        authors={authors}
        labels={labels}
        hasActiveFilters={hasActiveFilters}
      />
      {filteredPrs.length === 0 ? (
        <div className={styles.emptyState}>
          <GitPullRequestIcon className={styles.emptyIcon} size={48} />
          <h3 className={styles.emptyTitle}>No matching pull requests</h3>
          <p className={styles.emptyText}>
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <div className={styles.prList}>
          {filteredPrs.map((pr) => (
            <PRListItem key={pr.id} pr={pr} repoFullName={fullName} isApproved={pr.merged === true} />
          ))}
        </div>
      )}
      {filteredPrs.length > 0 && (
        <div className={styles.resultsCount}>
          Showing {filteredPrs.length} of {prs.length} pull requests
        </div>
      )}
    </div>
  )
}

// Colocated filter components (only used in RepoPullsTab)

interface FiltersBarProps {
  filters: PRFilters
  onFiltersChange: (filters: PRFilters) => void
  authors: string[]
  labels: string[]
  hasActiveFilters: boolean
}

const FiltersBar = ({ filters, onFiltersChange, authors, labels, hasActiveFilters }: FiltersBarProps) => {
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
              onSelect={() => updateFilter("status", option.value)}
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
            <FilterMenuItem selected={filters.author === null} onSelect={() => updateFilter("author", null)}>
              Any
            </FilterMenuItem>
            <Menu.Separator className={styles.menuSeparator} />
            {authors.map((author) => (
              <FilterMenuItem
                key={author}
                selected={filters.author === author}
                onSelect={() => updateFilter("author", author)}
              >
                {author}
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
                onCheckedChange={() => toggleLabel(label)}
              >
                <Menu.CheckboxItemIndicator className={styles.checkIndicator}>✓</Menu.CheckboxItemIndicator>
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
              onSelect={() => updateFilter("draft", option.value)}
            >
              {option.label}
            </FilterMenuItem>
          ))}
        </FilterDropdown>

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
              onSelect={() => updateFilter("sortBy", option.value)}
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
  onSelect: () => void
  children: React.ReactNode
}

const FilterMenuItem = ({ selected, onSelect, children }: FilterMenuItemProps) => (
  <Menu.Item
    className={styles.menuItem}
    data-selected={selected || undefined}
    onSelect={onSelect}
  >
    {children}
  </Menu.Item>
)
