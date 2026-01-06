import { createFileRoute } from "@tanstack/react-router"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoIssuesTab } from "@/features/repo/RepoIssuesTab"

function RepoIssuesPage() {
  const { owner, repo } = Route.useParams()
  const fullName = `${owner}/${repo}`

  return (
    <RepoLayout activeTab="issues">
      {(repoData) => (
        <RepoIssuesTab
          issues={repoData.issues as Parameters<typeof RepoIssuesTab>[0]["issues"]}
          fullName={fullName}
        />
      )}
    </RepoLayout>
  )
}

export const Route = createFileRoute("/$owner/$repo/issues")({
  component: RepoIssuesPage,
})
