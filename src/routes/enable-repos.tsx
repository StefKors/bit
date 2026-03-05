import { createFileRoute } from "@tanstack/react-router"
import { EnableReposPage } from "@/features/enable-repos/EnableReposPage"

export const Route = createFileRoute("/enable-repos")({
  component: EnableReposPage,
})
