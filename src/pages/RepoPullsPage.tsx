import { useParams } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@/db/queries"
import { RepoLayout } from "@/features/repo/RepoLayout"
import { RepoPullsTab } from "@/features/repo/RepoPullsTab"

export function RepoPullsPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  // Query the repo from Zero
  const [repo] = useQuery(queries.repo(fullName))

  return (
    <RepoLayout activeTab="pulls">
      {repo && <RepoPullsTab repoId={repo.id} fullName={fullName} />}
    </RepoLayout>
  )
}
