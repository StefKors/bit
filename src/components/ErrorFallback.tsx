import type { ErrorComponentProps } from "@tanstack/react-router"
import { ErrorPage } from "./ErrorPage"

interface ErrorPresentation {
  title: string
  message: string
}

type RouteErrorValue =
  | Error
  | string
  | {
      statusCode?: number
      message?: string
    }
  | null
  | undefined

const getErrorMessage = (error: RouteErrorValue): string => {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (typeof error === "object" && error?.message) return error.message
  return "An unexpected error occurred"
}

const hasStatusCode = (
  error: RouteErrorValue,
): error is {
  statusCode: number
  message?: string
} => typeof error === "object" && error !== null && "statusCode" in error

const getStatusCode = (error: RouteErrorValue): number | null =>
  hasStatusCode(error) ? error.statusCode : null

const getErrorPresentation = (message: string, statusCode: number | null): ErrorPresentation => {
  if (statusCode === 404) {
    return {
      title: "Page not found",
      message: "The page you requested does not exist or was moved.",
    }
  }

  if (message.includes("FileDiff: Provided patch must contain exactly 1 file diff")) {
    return {
      title: "Could not render this diff",
      message:
        "The patch format is invalid for this view. Provide exactly one file diff in the patch content.",
    }
  }

  return {
    title: "Something went wrong",
    message: "An unexpected error occurred while loading this page.",
  }
}

export const ErrorFallback = ({ error, reset }: ErrorComponentProps) => {
  const routeError = error as RouteErrorValue
  const message = getErrorMessage(routeError)
  const statusCode = getStatusCode(routeError)
  const presentation = getErrorPresentation(message, statusCode)

  return (
    <ErrorPage
      title={presentation.title}
      message={presentation.message}
      details={message}
      onRetry={reset}
    />
  )
}
