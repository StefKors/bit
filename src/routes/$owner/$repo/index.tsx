import { createFileRoute } from "@tanstack/react-router"
import { RepoPrOverviewPage } from "@/features/repo-pr-overview/RepoPrOverviewPage"

export const Route = createFileRoute("/$owner/$repo/")({
  component: RepoPrOverviewRoute,
})

function RepoPrOverviewRoute() {
  const { owner, repo } = Route.useParams()

  return <RepoPrOverviewPage owner={owner} repo={repo} selectedPrNumber={null} />
}
