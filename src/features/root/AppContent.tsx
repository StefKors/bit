import { Outlet } from "@tanstack/react-router"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import LoginPage from "@/pages/LoginPage"
import { useAuth } from "@/lib/hooks/useAuth"

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
        <div style={{ padding: "2rem", color: "#f85149" }}>
          Authentication error: {error.message}
        </div>
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
