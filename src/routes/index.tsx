import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "@/features/home/HomePage"

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, string | number | boolean | null | undefined>) => ({
    github: search.github as string | undefined,
    error: search.error as string | undefined,
    message: search.message as string | undefined,
  }),
})
