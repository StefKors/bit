import { createFileRoute } from "@tanstack/react-router"
import { RepoPrOverviewPage } from "@/features/repo-pr-overview/RepoPrOverviewPage"

export const Route = createFileRoute("/$owner/$repo/$prNumber")({
  component: RepoPrOverviewWithPrRoute,
})

function RepoPrOverviewWithPrRoute() {
  const { owner, repo, prNumber } = Route.useParams()
  const parsedPrNumber = Number(prNumber)
  const selectedPrNumber = Number.isNaN(parsedPrNumber) ? null : parsedPrNumber

  return <RepoPrOverviewPage owner={owner} repo={repo} selectedPrNumber={selectedPrNumber} />
}
