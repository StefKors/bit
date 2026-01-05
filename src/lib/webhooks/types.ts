import { drizzle } from "drizzle-orm/node-postgres"
import * as dbSchema from "../../../schema"

export type WebhookDB = ReturnType<typeof drizzle<typeof dbSchema>>

export type WebhookPayload = Record<string, unknown>

export type RepoRecord = typeof dbSchema.githubRepo.$inferSelect
export type PRRecord = typeof dbSchema.githubPullRequest.$inferSelect

