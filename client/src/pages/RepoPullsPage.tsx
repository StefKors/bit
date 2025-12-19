import { useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { RepoLayout } from "@/components/RepoLayout"
import { RepoPullsTab } from "@/components/RepoPullsTab"

export function RepoPullsPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repos] = useQuery(queries.repo(fullName))
  const repo = repos[0]

  return (
    <RepoLayout activeTab="pulls">
      {repo && <RepoPullsTab repoId={repo.id} fullName={fullName} />}
    </RepoLayout>
  )
}
