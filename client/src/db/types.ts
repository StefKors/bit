import type { Schema } from "./schema"

export type AuthData = {
  userID: string | null
}

// Extend Zero's DefaultTypes to include our auth context
declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: Schema
    context: AuthData
  }
}
