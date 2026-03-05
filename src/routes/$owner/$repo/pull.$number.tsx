import { createFileRoute } from "@tanstack/react-router"
import { PullDetailPage } from "@/features/pull-detail/PullDetailPage"

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  component: PullDetailPage,
})
