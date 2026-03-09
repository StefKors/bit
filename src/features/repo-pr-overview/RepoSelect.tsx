import { useNavigate } from "@tanstack/react-router"
import { RepoIcon } from "@primer/octicons-react"
import { db } from "@/lib/InstantDb"
import { ToolbarSelect } from "@/components/ToolbarSelect"
import styles from "./RepoSelect.module.css"

interface RepoSelectProps {
  owner: string
  repo: string
}

export const RepoSelect = ({ owner, repo }: RepoSelectProps) => {
  const navigate = useNavigate()
  const currentFullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { order: { pushedAt: "desc" } },
    },
  })
  const repos = data?.repos ?? []
  const items = repos.map((r) => ({ value: r.fullName, label: r.fullName }))

  return (
    <ToolbarSelect
      value={currentFullName}
      onValueChange={(value) => {
        const r = repos.find((repo) => repo.fullName === value)
        if (r) {
          void navigate({ to: "/$owner/$repo", params: { owner: r.owner, repo: r.name } })
        }
      }}
      items={items}
      icon={<RepoIcon size={12} />}
      itemIcon={<RepoIcon size={12} />}
      emptyLabel="No repositories"
      triggerClassName={styles.repoTrigger}
    />
  )
}
