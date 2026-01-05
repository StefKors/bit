/// <reference types="vite/client" />
import type { ReactNode } from "react"
import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router"
import { ZeroProvider } from "@rocicorp/zero/react"
import { useState } from "react"
import { mutators } from "@/db/mutators"
import { schema } from "@/db/schema"
import "@/db/types"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import LoginPage from "@/pages/LoginPage"
import { authClient } from "@/lib/auth"
import "@/theme.css"
import "@/index.css"

const cacheURL = import.meta.env.VITE_PUBLIC_ZERO_CACHE_URL as string

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bit" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/public/bit-cube-small.png" }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <AppContent />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function AppContent() {
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
