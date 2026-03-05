import { getResolvedColorMode } from "@/lib/themes/ThemeManager"

export const currentColorScheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "light"
  return getResolvedColorMode()
}

export const isDark = () => currentColorScheme() === "dark"
export const isLight = () => currentColorScheme() === "light"
