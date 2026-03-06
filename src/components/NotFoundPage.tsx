import { ErrorPage } from "@/components/ErrorPage"

export const NotFoundPage = () => (
  <ErrorPage
    title="Page not found"
    message="The page you requested does not exist or may have been moved."
    showHomeAction
  />
)
