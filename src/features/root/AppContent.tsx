import { Outlet } from "@tanstack/react-router"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import { ErrorPage } from "@/components/ErrorPage"
import LoginPage from "@/pages/LoginPage"
import { useAuth } from "@/lib/hooks/UseAuth"

export function AppContent() {
  const { isLoading, user, error } = useAuth()

  if (isLoading) {
    return (
      <Layout>
        <LoadingCube />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <ErrorPage
          title="Authentication error"
          message="We could not verify your session. Please try again."
          details={error.message}
          onRetry={() => {
            window.location.reload()
          }}
        />
      </Layout>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
