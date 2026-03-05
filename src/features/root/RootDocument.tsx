import { useEffect, type ReactNode } from "react"
import { HeadContent, Scripts } from "@tanstack/react-router"
import { isDev } from "@/lib/utils/IsDevelopment"
import { initTheme, getResolvedColorMode } from "@/lib/themes/ThemeManager"

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    const cleanup = initTheme()

    const updateFavicon = () => {
      const light = getResolvedColorMode() === "light"
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (link) {
        link.href = `/bit-cube-small${light ? "-light" : ""}${isDev ? "-dev" : ""}.png`
      }
    }

    updateFavicon()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-color-mode") {
          updateFavicon()
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })

    return () => {
      cleanup?.()
      observer.disconnect()
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
