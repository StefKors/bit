export interface ThemeDefinition {
  id: string
  name: string
  group: string
  previewColors: {
    dark: string[]
    light: string[]
  }
}

export type ColorMode = "light" | "dark" | "system"

export const themes: ThemeDefinition[] = [
  {
    id: "bit-classic",
    name: "Bit Classic",
    group: "Standard",
    previewColors: {
      dark: ["#0a0a0a", "#1a1a1a", "#60acff", "#34a84b", "#ac80ff", "#ff5c52"],
      light: ["#ffffff", "#eeeff1", "#387ee6", "#288c3a", "#8860d0", "#e03e36"],
    },
  },
  {
    id: "linear",
    name: "Linear",
    group: "Standard",
    previewColors: {
      dark: ["#111214", "#222326", "#5e6ad2", "#4cb782", "#9b8afb", "#eb5757"],
      light: ["#ffffff", "#eef0f4", "#5e6ad2", "#3a9a6c", "#7b6be0", "#d94848"],
    },
  },
  {
    id: "linear-classic",
    name: "Linear Classic",
    group: "Standard",
    previewColors: {
      dark: ["#19191c", "#2a2a2e", "#5e6ad2", "#4cb782", "#9b8afb", "#eb5757"],
      light: ["#f7f7f8", "#f0f0f2", "#5e6ad2", "#3a9a6c", "#7b6be0", "#d94848"],
    },
  },
  {
    id: "github-classic",
    name: "GitHub Classic",
    group: "Standard",
    previewColors: {
      dark: ["#0d1117", "#21262d", "#58a6ff", "#3fb950", "#bc8cff", "#f85149"],
      light: ["#ffffff", "#eaeef2", "#0969da", "#1a7f37", "#8250df", "#cf222e"],
    },
  },
  {
    id: "macos",
    name: "macOS",
    group: "Standard",
    previewColors: {
      dark: ["#1e1e1e", "#323232", "#007aff", "#30d158", "#bf5af2", "#ff453a"],
      light: ["#f5f5f7", "#f0f0f2", "#007aff", "#28a745", "#af52de", "#ff3b30"],
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    group: "Community",
    previewColors: {
      dark: ["#282a36", "#353848", "#8be9fd", "#50fa7b", "#bd93f9", "#ff5555"],
      light: ["#f8f8f2", "#f0f0ea", "#2a8ca8", "#1f8a44", "#8860d0", "#d93c3c"],
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    group: "Community",
    previewColors: {
      dark: ["#282828", "#3c3836", "#83a598", "#b8bb26", "#d3869b", "#fb4934"],
      light: ["#fbf1c7", "#f2e5bc", "#458588", "#98971a", "#b16286", "#cc241d"],
    },
  },
  {
    id: "ayu",
    name: "Ayu",
    group: "Community",
    previewColors: {
      dark: ["#0f1419", "#1a2028", "#59c2ff", "#7fd962", "#d2a6ff", "#f07178"],
      light: ["#fafafa", "#f0f0f0", "#399ee6", "#6cbf43", "#a37acc", "#e65050"],
    },
  },
  {
    id: "copilot",
    name: "Copilot",
    group: "Standard",
    previewColors: {
      dark: ["#0d1117", "#1c2333", "#79c0ff", "#7ee787", "#a371f7", "#ff7b72"],
      light: ["#ffffff", "#eef1f6", "#0969da", "#1a7f37", "#8250df", "#cf222e"],
    },
  },
  {
    id: "pastels",
    name: "Pastels",
    group: "Fun",
    previewColors: {
      dark: ["#1e1a22", "#322e38", "#96beff", "#96dcaa", "#c8aaff", "#ff96a0"],
      light: ["#fff5f8", "#fcf0f4", "#6898d4", "#5cb87a", "#9878cc", "#e06878"],
    },
  },
  {
    id: "synthwave",
    name: "Synthwave",
    group: "Fun",
    previewColors: {
      dark: ["#1a1025", "#2a1f3d", "#00fff7", "#72ff9d", "#bd93f9", "#ff4466"],
      light: ["#faf5ff", "#f2ecfa", "#008888", "#2e8b57", "#8860d0", "#d83050"],
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    group: "Fun",
    previewColors: {
      dark: ["#0a1628", "#162848", "#00bcd4", "#00c896", "#82b1ff", "#ef5350"],
      light: ["#f0f8ff", "#e3f2fd", "#0288d1", "#00897b", "#4a6fa5", "#d32f2f"],
    },
  },
  {
    id: "pokemon-fire-red",
    name: "Fire Red",
    group: "Fun",
    previewColors: {
      dark: ["#1c0c08", "#341c14", "#5090d0", "#78c850", "#b478c8", "#e53935"],
      light: ["#fff8f0", "#ffeed8", "#3870a8", "#508830", "#8850a8", "#d32f2f"],
    },
  },
  {
    id: "pokemon-leaf-green",
    name: "Leaf Green",
    group: "Fun",
    previewColors: {
      dark: ["#0a1810", "#162c1e", "#64b4dc", "#4caf50", "#8cb4a0", "#ef5350"],
      light: ["#f0fff0", "#e0f5e2", "#3888b0", "#2e7d32", "#5e8872", "#c62828"],
    },
  },
]

export const getThemeById = (id: string): ThemeDefinition | undefined =>
  themes.find((t) => t.id === id)

export const DEFAULT_THEME_ID = "bit-classic"
export const DEFAULT_COLOR_MODE: ColorMode = "system"
