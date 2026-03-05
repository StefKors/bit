import { createFileRoute } from "@tanstack/react-router"
import { RepoPrOverviewPage } from "@/features/repo-pr-overview/RepoPrOverviewPage"

export const Route = createFileRoute("/$owner/$repo/")({
  validateSearch: (search: { selectedPrNumber?: string }) => ({
    selectedPrNumber:
      typeof search.selectedPrNumber === "string" ? search.selectedPrNumber : undefined,
  }),
  component: RepoPrOverviewPage,
})
