import { init } from "@instantdb/admin"
import { schema } from "@/instant.schema"

const adminToken = process.env.INSTANT_ADMIN_TOKEN

if (!adminToken) {
  throw new Error("Missing required environment variable: INSTANT_ADMIN_TOKEN")
}

// Initialize InstantDB Admin SDK for server-side operations
export const adminDb = init({
  appId: "82589b71-875c-4d6b-bf1a-78e0ad02b8ca",
  adminToken,
  schema,
})

// Re-export types for convenience
export type { AppSchema } from "@/instant.schema"
