export const parseJsonStringArray = (value: string | null | undefined): string[] => {
  if (!value) return []
  try {
    const parsed: string[] = JSON.parse(value) as string[]
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}
