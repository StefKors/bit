import {
  type ColorMode,
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_ID,
  getThemeCssVariables,
  getThemeById,
} from "./ThemeDefinitions"

const THEME_STORAGE_KEY = "bit-theme-id"
const MODE_STORAGE_KEY = "bit-color-mode"

const appliedVarNames: string[] = []

export const getStoredThemeId = (): string => {
  if (typeof window === "undefined") return DEFAULT_THEME_ID
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID
}

export const getStoredColorMode = (): ColorMode => {
  if (typeof window === "undefined") return DEFAULT_COLOR_MODE
  return (localStorage.getItem(MODE_STORAGE_KEY) as ColorMode) || DEFAULT_COLOR_MODE
}

export const resolveColorMode = (mode: ColorMode): "light" | "dark" => {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return mode
}

export const getResolvedColorMode = (): "light" | "dark" => {
  return resolveColorMode(getStoredColorMode())
}

export const applyTheme = (themeId?: string, mode?: ColorMode): void => {
  if (typeof document === "undefined") return

  const id = themeId ?? getStoredThemeId()
  const colorMode = mode ?? getStoredColorMode()
  const resolvedMode = resolveColorMode(colorMode)

  const vars = getThemeCssVariables(id, resolvedMode)
  const root = document.documentElement

  for (const name of appliedVarNames) {
    root.style.removeProperty(name)
  }
  appliedVarNames.length = 0

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
    appliedVarNames.push(name)
  }

  root.setAttribute("data-color-mode", resolvedMode)
  root.setAttribute("data-theme", id)
  root.style.colorScheme = resolvedMode
}

export const setThemeId = (themeId: string): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(THEME_STORAGE_KEY, themeId)
  applyTheme(themeId)
}

export const setColorMode = (mode: ColorMode): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(MODE_STORAGE_KEY, mode)
  applyTheme(undefined, mode)
}

export const initTheme = (): (() => void) | undefined => {
  if (typeof window === "undefined") return undefined

  applyTheme()

  const storedMode = getStoredColorMode()
  if (storedMode === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      applyTheme()
    }
    mq.addEventListener("change", handler)
    return () => {
      mq.removeEventListener("change", handler)
    }
  }
  return undefined
}

export const getThemePreviewColors = (themeId: string, mode: "light" | "dark"): string[] => {
  const theme = getThemeById(themeId)
  if (!theme) return []
  const c = mode === "light" ? theme.light : theme.dark
  return [c.bg, c.surface2, c.accentBlue, c.accentGreen, c.accentPurple, c.accentRed]
}
