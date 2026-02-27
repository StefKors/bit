import { createFileRoute } from "@tanstack/react-router"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoCommitsTab } from "@/features/repo/RepoCommitsTab"

function RepoCommitsPage() {
  const { owner, repo, branch } = Route.useParams()
  const fullName = `${owner}/${repo}`

  return (
    <RepoLayout activeTab="commits">
      {(repoData) => (
        <RepoCommitsTab
          repoId={repoData.id}
          fullName={fullName}
          branch={branch}
          githubPushedAt={repoData.githubPushedAt}
        />
      )}
    </RepoLayout>
  )
}

export const Route = createFileRoute("/$owner/$repo/commits/$branch")({
  component: RepoCommitsPage,
})
