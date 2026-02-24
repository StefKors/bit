import { z } from "zod"

const stringArraySchema = z.array(z.string())

export const parseStringArray = (raw: string | null | undefined): string[] => {
  if (!raw) return []
  try {
    const result = stringArraySchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : []
  } catch {
    return []
  }
}

const initialSyncProgressSchema = z.object({
  step: z.enum(["orgs", "repos", "webhooks", "pullRequests", "completed"]),
  orgs: z.object({ total: z.number() }).optional(),
  repos: z.object({ total: z.number() }).optional(),
  webhooks: z.object({ completed: z.number(), total: z.number() }).optional(),
  pullRequests: z
    .object({ completed: z.number(), total: z.number(), prsFound: z.number() })
    .optional(),
  error: z.string().optional(),
})

export type InitialSyncProgress = z.infer<typeof initialSyncProgressSchema>

export const parseInitialSyncProgress = (
  raw: string | null | undefined,
): InitialSyncProgress | null => {
  if (!raw) return null
  try {
    const result = initialSyncProgressSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
