import { createRootRoute, Outlet, redirect } from "@tanstack/react-router"
import { ZeroProvider } from "@rocicorp/zero/react"
import { useState } from "react"
import { mutators } from "@/db/mutators"
import { schema } from "@/db/schema"
import "@/db/types"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import LoginPage from "@/pages/LoginPage"
import { authClient } from "@/lib/auth"

const cacheURL = import.meta.env.VITE_PUBLIC_ZERO_CACHE_URL as string

function RootComponent() {
  const { data: session, isPending } = authClient.useSession()
  const [forceReload, setForceReload] = useState(0)

  const userID = session?.user?.id ?? null
  const context = { userID }

  const handleAuthChange = () => {
    setForceReload((prev) => prev + 1)
    window.location.reload()
  }

  if (isPending) {
    return (
      <Layout>
        <LoadingCube />
      </Layout>
    )
  }

  if (!session) {
    return <LoginPage onLogin={handleAuthChange} />
  }

  return (
    <ZeroProvider
      key={`${userID}-${forceReload}`}
      {...{
        userID: userID ?? "anon",
        cacheURL,
        schema,
        mutators,
        context,
      }}
    >
      <Layout>
        <Outlet />
      </Layout>
    </ZeroProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
