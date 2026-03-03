export const parseWebhookEventsEnabled = (
  raw: string | null | undefined,
): Set<string> | null => {
  if (!raw || typeof raw !== "string") return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; values are validated below
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    return new Set((parsed as string[]).filter((x): x is string => typeof x === "string"))
  } catch {
    return null
  }
}
