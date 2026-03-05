/// <reference types="vite/client" />
import { createRootRoute } from "@tanstack/react-router"
import { RootDocument } from "@/features/root/RootDocument"
import { AppContent } from "@/features/root/AppContent"
import { ErrorFallback } from "@/components/ErrorFallback"
import { isDev } from "@/lib/utils/isDevelopment"
import { isLight } from "@/lib/utils/currentColorScheme"
import "@/theme.css"
import "@/index.css"

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
  errorComponent: ErrorFallback,
})

function RootComponent() {
  return (
    <RootDocument>
      <AppContent />
    </RootDocument>
  )
}
