/// <reference types="vite/client" />
import type { ReactNode } from "react"
import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import LoginPage from "@/pages/LoginPage"
import { db } from "@/lib/instantDb"
import "@/theme.css"
import "@/index.css"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bit" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/bit-cube-small.png" }],
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
  const { isLoading, user, error } = db.useAuth()

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
