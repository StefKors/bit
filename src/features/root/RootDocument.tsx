import { useEffect, type ReactNode } from "react"
import { HeadContent, Scripts } from "@tanstack/react-router"
import { isDev } from "@/lib/utils/isDevelopment"

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
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
    return () => {
      mediaQuery.removeEventListener("change", updateFavicon)
    }
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
