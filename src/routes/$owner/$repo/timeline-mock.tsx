import { createFileRoute } from "@tanstack/react-router"
import { TimelineMockPage } from "@/features/repo-pr-overview/TimelineMockPage"

export const Route = createFileRoute("/$owner/$repo/timeline-mock")({
  component: TimelineMockRoute,
})

function TimelineMockRoute() {
  const { owner, repo } = Route.useParams()

  return <TimelineMockPage owner={owner} repo={repo} />
}
