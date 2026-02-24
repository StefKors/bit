export type PRLayoutMode = "default" | "full-screen-3-column"

const PR_LAYOUT_MODE_STORAGE_KEY = "bit:pr-layout-mode"
const DEFAULT_PR_LAYOUT_MODE: PRLayoutMode = "default"

const parsePRLayoutMode = (value: unknown): PRLayoutMode => {
  if (value === "full-screen-3-column") {
    return "full-screen-3-column"
  }
  return DEFAULT_PR_LAYOUT_MODE
}

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export const getPRLayoutMode = (
  storage: Pick<Storage, "getItem"> | null = getBrowserStorage(),
): PRLayoutMode => {
  if (!storage) return DEFAULT_PR_LAYOUT_MODE
  return parsePRLayoutMode(storage.getItem(PR_LAYOUT_MODE_STORAGE_KEY))
}

export const setPRLayoutMode = (
  mode: PRLayoutMode,
  storage: Pick<Storage, "setItem"> | null = getBrowserStorage(),
): void => {
  if (!storage) return
  storage.setItem(PR_LAYOUT_MODE_STORAGE_KEY, mode)
}

export const isFullScreenPRLayoutEnabled = (
  storage: Pick<Storage, "getItem"> | null = getBrowserStorage(),
): boolean => {
  return getPRLayoutMode(storage) === "full-screen-3-column"
}
