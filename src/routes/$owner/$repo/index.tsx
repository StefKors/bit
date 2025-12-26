import { createFileRoute } from "@tanstack/react-router"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoCodeTab } from "@/features/repo/RepoCodeTab"

function RepoPage() {
  const { owner, repo } = Route.useParams()
  const fullName = `${owner}/${repo}`

  return <RepoLayout activeTab="code">{() => <RepoCodeTab fullName={fullName} />}</RepoLayout>
}

export const Route = createFileRoute("/$owner/$repo/")({
  component: RepoPage,
})
