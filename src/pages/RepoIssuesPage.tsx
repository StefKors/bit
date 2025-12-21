import { useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoIssuesTab } from "@/features/repo/RepoIssuesTab"

export function RepoIssuesPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero (repo query returns single result via .one())
  const [repo] = useQuery(queries.repo(fullName))

  return (
    <RepoLayout activeTab="issues">
      {repo && <RepoIssuesTab repoId={repo.id} fullName={fullName} />}
    </RepoLayout>
  )
}
