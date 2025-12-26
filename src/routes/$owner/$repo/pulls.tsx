import { createFileRoute } from "@tanstack/react-router"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoPullsTab } from "@/features/repo/RepoPullsTab"

function RepoPullsPage() {
  const { owner, repo } = Route.useParams()
  const fullName = `${owner}/${repo}`

  return (
    <RepoLayout activeTab="pulls">
      {(repoData) => <RepoPullsTab prs={repoData.githubPullRequest} fullName={fullName} />}
    </RepoLayout>
  )
}

export const Route = createFileRoute("/$owner/$repo/pulls")({
  component: RepoPullsPage,
})
