import {
  type ColorMode,
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_ID,
  getThemeById,
} from "./ThemeDefinitions"

const THEME_STORAGE_KEY = "bit-theme-id"
const MODE_STORAGE_KEY = "bit-color-mode"

// Each importer dynamically loads a theme CSS file. Vite handles these as
// separate chunks that are only fetched when the theme is first selected.
// Once loaded, the [data-theme][data-color-mode] selectors activate the theme.
const themeImporters: Record<string, () => void> = {
  "bit-classic": () => void import("./css/bit-classic.css"),
  linear: () => void import("./css/linear.css"),
  "linear-classic": () => void import("./css/linear-classic.css"),
  "github-classic": () => void import("./css/github-classic.css"),
  macos: () => void import("./css/macos.css"),
  dracula: () => void import("./css/dracula.css"),
  gruvbox: () => void import("./css/gruvbox.css"),
  ayu: () => void import("./css/ayu.css"),
  copilot: () => void import("./css/copilot.css"),
  pastels: () => void import("./css/pastels.css"),
  synthwave: () => void import("./css/synthwave.css"),
  ocean: () => void import("./css/ocean.css"),
  "pokemon-fire-red": () => void import("./css/pokemon-fire-red.css"),
  "pokemon-leaf-green": () => void import("./css/pokemon-leaf-green.css"),
}

const loadedThemes = new Set<string>()

const loadThemeCss = (themeId: string): void => {
  if (loadedThemes.has(themeId)) return
  const importer = themeImporters[themeId]
  if (importer) {
    loadedThemes.add(themeId)
    importer()
  }
}

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

  const root = document.documentElement
  root.setAttribute("data-color-mode", resolvedMode)
  root.setAttribute("data-theme", id)
  root.style.colorScheme = resolvedMode

  loadThemeCss(id)
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
  return mode === "light" ? theme.previewColors.light : theme.previewColors.dark
}
