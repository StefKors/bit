import { init } from "@instantdb/react"
import schema from "@/instant.schema"

// Initialize InstantDB client
export const db = init({
  appId: "82589b71-875c-4d6b-bf1a-78e0ad02b8ca",
  schema,
})

// Re-export types for convenience
export type { AppSchema } from "@/instant.schema"
