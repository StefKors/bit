export const currentColorScheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export const isDark = () => currentColorScheme() === "dark"
export const isLight = () => currentColorScheme() === "light"
