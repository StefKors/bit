import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoPullsTab } from "@/features/repo/RepoPullsTab"
import {
  type PRFilters,
  type PRFiltersSearchParams,
  parseFiltersFromSearch,
  filtersToSearchParams,
} from "@/lib/pr-filters"

function RepoPullsPage() {
  const { owner, repo } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const fullName = `${owner}/${repo}`

  const filters = parseFiltersFromSearch(search)

  const handleFiltersChange = (newFilters: PRFilters) => {
    const searchParams = filtersToSearchParams(newFilters)
    void navigate({
      to: "/$owner/$repo/pulls",
      params: { owner, repo },
      search: searchParams,
      replace: true,
    })
  }

  return (
    <RepoLayout activeTab="pulls">
      {(repoData) => (
        <RepoPullsTab
          prs={repoData.pullRequests as Parameters<typeof RepoPullsTab>[0]["prs"]}
          fullName={fullName}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
      )}
    </RepoLayout>
  )
}

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: RepoPullsPage,
  validateSearch: (
    search: Record<string, string | number | boolean | null | undefined>,
  ): PRFiltersSearchParams => {
    return filtersToSearchParams(parseFiltersFromSearch(search))
  },
})
