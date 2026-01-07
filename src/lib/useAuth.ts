import { InstaQLEntity } from "@instantdb/react"
import type { AppSchema } from "@/instant.schema"
import { db } from "./instantDb"

// Type derived from schema $users entity
export type User = InstaQLEntity<AppSchema, "$users">

// Hook wrapper that provides fully typed user object
export function useAuth() {
  const { user, isLoading, error } = db.useAuth()

  return {
    user: user as User | null,
    isLoading,
    error,
    signOut: db.auth.signOut,
  }
}
