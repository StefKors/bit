import { createFileRoute } from "@tanstack/react-router"
import { RepoPROverviewPage } from "@/features/repo-pr-overview/RepoPROverviewPage"

export const Route = createFileRoute("/$owner/$repo/")({
  validateSearch: (search: { selectedPrNumber?: string }) => ({
    selectedPrNumber:
      typeof search.selectedPrNumber === "string" ? search.selectedPrNumber : undefined,
  }),
  component: RepoPROverviewPage,
})
