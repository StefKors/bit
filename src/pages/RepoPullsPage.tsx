import { useParams } from "wouter"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoPullsTab } from "@/features/repo/RepoPullsTab"

export function RepoPullsPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  return (
    <RepoLayout activeTab="pulls">
      {(repo) => (
        <RepoPullsTab prs={repo.githubPullRequest} fullName={fullName} />
      )}
    </RepoLayout>
  )
}
