export const VIEWED_FILES_STORAGE_KEY = "bit:pr:viewed-files"

export const buildViewedFilesKey = (owner: string, repo: string, prNumber: number): string =>
  `${owner}/${repo}#${prNumber}`

export const parseViewedFilesStorage = (raw: string | null): Record<string, string[]> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, Array<string | number | boolean | null>>
    if (!parsed || typeof parsed !== "object") return {}

    const entries = Object.entries(parsed)
    const result: Record<string, string[]> = {}
    for (const [key, value] of entries) {
      if (!Array.isArray(value)) continue
      result[key] = value.filter((item): item is string => typeof item === "string")
    }
    return result
  } catch {
    return {}
  }
}

export const getViewedFilesForKey = (storage: Record<string, string[]>, key: string): string[] =>
  storage[key] ?? []

export const setViewedFilesForKey = (
  storage: Record<string, string[]>,
  key: string,
  files: string[],
): Record<string, string[]> => ({
  ...storage,
  [key]: [...new Set(files)],
})

export const toggleViewedFile = (
  currentFiles: string[],
  filePath: string,
  viewed: boolean,
): string[] => {
  const currentSet = new Set(currentFiles)
  if (viewed) {
    currentSet.add(filePath)
  } else {
    currentSet.delete(filePath)
  }
  return [...currentSet]
}

export const getViewedFilesFromStorageValue = (raw: string | null, key: string): string[] => {
  const storage = parseViewedFilesStorage(raw)
  return getViewedFilesForKey(storage, key)
}

export const setViewedFilesInStorageValue = (
  raw: string | null,
  key: string,
  files: string[],
): string => {
  const storage = parseViewedFilesStorage(raw)
  const nextStorage = setViewedFilesForKey(storage, key, files)
  return JSON.stringify(nextStorage)
}

export const readViewedFilesFromLocalStorage = (key: string): string[] => {
  if (typeof window === "undefined") return []
  return getViewedFilesFromStorageValue(window.localStorage.getItem(VIEWED_FILES_STORAGE_KEY), key)
}

export const writeViewedFilesToLocalStorage = (key: string, files: string[]): void => {
  if (typeof window === "undefined") return
  const nextValue = setViewedFilesInStorageValue(
    window.localStorage.getItem(VIEWED_FILES_STORAGE_KEY),
    key,
    files,
  )
  window.localStorage.setItem(VIEWED_FILES_STORAGE_KEY, nextValue)
}
