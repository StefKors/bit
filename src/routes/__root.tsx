/// <reference types="vite/client" />
import { useEffect, type ReactNode } from "react"
import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router"
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import { CommandMenu } from "@/components/CommandMenu"
import LoginPage from "@/pages/LoginPage"
import { db } from "@/lib/instantDb"
import "@/theme.css"
import "@/index.css"
import { isDev } from "@/lib/utils/isDevelopment"
import { isLight } from "@/lib/utils/currentColorScheme"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: isDev ? "Bit (Dev)" : "Bit" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: `/bit-cube-small${isLight() ? "-light" : ""}${isDev ? "-dev" : ""}.png`,
      },
    ],
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
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateFavicon = () => {
      const light = !mediaQuery.matches
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (link) {
        link.href = `/bit-cube-small${light ? "-light" : ""}${isDev ? "-dev" : ""}.png`
      }
    }
    updateFavicon()
    mediaQuery.addEventListener("change", updateFavicon)
    return () => mediaQuery.removeEventListener("change", updateFavicon)
  }, [])

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
      <CommandMenu />
      <Outlet />
    </Layout>
  )
}
