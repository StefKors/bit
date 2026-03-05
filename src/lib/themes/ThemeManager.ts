import {
  type ColorMode,
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_ID,
  getThemeById,
  themes,
} from "./ThemeDefinitions"
import "./css/bit-classic.css"

const THEME_STORAGE_KEY = "bit-theme-id"
const MODE_STORAGE_KEY = "bit-color-mode"

const VALID_COLOR_MODES = new Set<string>(["light", "dark", "system"])
const VALID_THEME_IDS = new Set<string>(themes.map((t) => t.id))

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable (e.g. Safari private browsing)
  }
}

// Each importer dynamically loads a theme CSS file. Vite handles these as
// separate chunks that are only fetched when the theme is first selected.
// Once loaded, the [data-theme][data-color-mode] selectors activate the theme.
// bit-classic is statically imported above to prevent flash of unstyled content.
const loadedThemes = new Set<string>(["bit-classic"])
const loadingThemes = new Set<string>()

const importThemeCss = (themeId: string): Promise<void> => {
  switch (themeId) {
    case "linear":
      return import("./css/linear.css").then(() => {})
    case "linear-classic":
      return import("./css/linear-classic.css").then(() => {})
    case "github-classic":
      return import("./css/github-classic.css").then(() => {})
    case "macos":
      return import("./css/macos.css").then(() => {})
    case "dracula":
      return import("./css/dracula.css").then(() => {})
    case "gruvbox":
      return import("./css/gruvbox.css").then(() => {})
    case "ayu":
      return import("./css/ayu.css").then(() => {})
    case "copilot":
      return import("./css/copilot.css").then(() => {})
    case "pastels":
      return import("./css/pastels.css").then(() => {})
    case "synthwave":
      return import("./css/synthwave.css").then(() => {})
    case "ocean":
      return import("./css/ocean.css").then(() => {})
    case "pokemon-fire-red":
      return import("./css/pokemon-fire-red.css").then(() => {})
    case "pokemon-leaf-green":
      return import("./css/pokemon-leaf-green.css").then(() => {})
    default:
      return Promise.resolve()
  }
}

const loadThemeCss = (themeId: string): void => {
  if (loadedThemes.has(themeId) || loadingThemes.has(themeId)) return
  loadingThemes.add(themeId)
  importThemeCss(themeId)
    .then(() => {
      loadingThemes.delete(themeId)
      loadedThemes.add(themeId)
    })
    .catch(() => {
      loadingThemes.delete(themeId)
    })
}

export const getStoredThemeId = (): string => {
  if (typeof window === "undefined") return DEFAULT_THEME_ID
  const stored = safeGetItem(THEME_STORAGE_KEY)
  if (stored && VALID_THEME_IDS.has(stored)) return stored
  return DEFAULT_THEME_ID
}

export const getStoredColorMode = (): ColorMode => {
  if (typeof window === "undefined") return DEFAULT_COLOR_MODE
  const stored = safeGetItem(MODE_STORAGE_KEY)
  if (stored && VALID_COLOR_MODES.has(stored)) return stored as ColorMode
  return DEFAULT_COLOR_MODE
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

const colorModeListeners = new Set<() => void>()

const notifyColorModeListeners = (): void => {
  for (const listener of colorModeListeners) {
    listener()
  }
}

export const subscribeColorMode = (listener: () => void): (() => void) => {
  colorModeListeners.add(listener)
  return () => {
    colorModeListeners.delete(listener)
  }
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
  notifyColorModeListeners()
}

export const setThemeId = (themeId: string): void => {
  if (typeof window === "undefined") return
  safeSetItem(THEME_STORAGE_KEY, themeId)
  applyTheme(themeId)
}

export const setColorMode = (mode: ColorMode): void => {
  if (typeof window === "undefined") return
  safeSetItem(MODE_STORAGE_KEY, mode)
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
