// These data structures define your client-side schema.
// They must be equal to or a subset of the server-side schema.
// See https://github.com/rocicorp/mono/blob/main/apps/zbugs/shared/schema.ts

import { createBuilder, createSchema, Row, table, string, boolean } from "@rocicorp/zero"

const user = table("user")
  .columns({
    id: string(),
    name: string(),
    partner: boolean(),
  })
  .primaryKey("id")

export const schema = createSchema({
  tables: [user],
  relationships: [],
  enableLegacyQueries: false,
  enableLegacyMutators: false,
})

export const zql = createBuilder(schema)

export type Schema = typeof schema
export type User = Row<typeof schema.tables.user>

export type AuthData = {
  userID: string | null
}

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: Schema
    context: AuthData
  }
}
