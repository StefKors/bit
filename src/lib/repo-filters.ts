// Repository filter types and utilities

export type RepoType = "all" | "source" | "fork"
export type RepoSortBy = "updated" | "name" | "stars" | "forks"
export type SortDirection = "asc" | "desc"

export type RepoFilters = {
  search: string
  type: RepoType
  language: string | null
  sortBy: RepoSortBy
  sortDirection: SortDirection
}

export const DEFAULT_REPO_FILTERS: RepoFilters = {
  search: "",
  type: "all",
  language: null,
  sortBy: "updated",
  sortDirection: "desc",
}

export const TYPE_OPTIONS: { value: RepoType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "source", label: "Sources" },
  { value: "fork", label: "Forks" },
]

export const SORT_OPTIONS: { value: RepoSortBy; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
]

export type FilterableRepo = {
  id: string
  name: string
  fullName?: string
  owner: string
  fork?: boolean | null
  language?: string | null
  stargazersCount?: number | null
  forksCount?: number | null
  githubUpdatedAt?: number | null
}

export const extractLanguages = (repos: readonly FilterableRepo[]): string[] => {
  const languages = new Set<string>()
  for (const repo of repos) {
    if (repo.language) {
      languages.add(repo.language)
    }
  }
  return Array.from(languages).sort()
}

export const applyFiltersAndSort = <T extends FilterableRepo>(
  repos: readonly T[],
  filters: RepoFilters,
): T[] => {
  let result = [...repos]

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    result = result.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchLower) ||
        repo.fullName?.toLowerCase().includes(searchLower),
    )
  }

  // Apply type filter
  if (filters.type === "source") {
    result = result.filter((repo) => repo.fork !== true)
  } else if (filters.type === "fork") {
    result = result.filter((repo) => repo.fork === true)
  }

  // Apply language filter
  if (filters.language) {
    result = result.filter((repo) => repo.language === filters.language)
  }

  // Apply sorting
  const direction = filters.sortDirection === "desc" ? -1 : 1
  result.sort((a, b) => {
    switch (filters.sortBy) {
      case "name":
        return direction * a.name.localeCompare(b.name)
      case "stars":
        return direction * ((a.stargazersCount ?? 0) - (b.stargazersCount ?? 0))
      case "forks":
        return direction * ((a.forksCount ?? 0) - (b.forksCount ?? 0))
      case "updated":
      default:
        return direction * ((a.githubUpdatedAt ?? 0) - (b.githubUpdatedAt ?? 0))
    }
  })

  return result
}

export const checkActiveFilters = (filters: RepoFilters): boolean => {
  return (
    filters.search !== DEFAULT_REPO_FILTERS.search ||
    filters.type !== DEFAULT_REPO_FILTERS.type ||
    filters.language !== DEFAULT_REPO_FILTERS.language ||
    filters.sortBy !== DEFAULT_REPO_FILTERS.sortBy
  )
}
