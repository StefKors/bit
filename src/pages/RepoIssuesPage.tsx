import { useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { RepoLayout } from "@/components/RepoLayout"
import { RepoIssuesTab } from "@/components/RepoIssuesTab"

export function RepoIssuesPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repos] = useQuery(queries.repo(fullName))
  const repo = repos[0]

  return (
    <RepoLayout activeTab="issues">
      {repo && <RepoIssuesTab repoId={repo.id} fullName={fullName} />}
    </RepoLayout>
  )
}
