import { createFileRoute, Link } from "@tanstack/react-router"

function PullDetailPage() {
  const { owner, repo, number } = Route.useParams()

  return (
    <div style={{ padding: "1rem" }}>
      <Link to="/$owner/$repo" params={{ owner, repo }}>
        ← Back to {owner}/{repo}
      </Link>
      <h1>PR #{number}</h1>
      <p>PR detail placeholder</p>
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  component: PullDetailPage,
})
