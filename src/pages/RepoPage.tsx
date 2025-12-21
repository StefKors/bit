import { useParams } from "wouter"
import { RepoLayout } from "@/components/RepoLayout"
import { RepoCodeTab } from "@/components/RepoCodeTab"

export function RepoPage() {
  const params = useParams<{ owner: string; repo: string }>()
  const owner = params.owner || ""
  const repoName = params.repo || ""
  const fullName = `${owner}/${repoName}`

  return (
    <RepoLayout activeTab="code">
      <RepoCodeTab fullName={fullName} />
    </RepoLayout>
  )
}
