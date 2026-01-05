import { createFileRoute } from "@tanstack/react-router"
import { mustGetQuery } from "@rocicorp/zero"
import { handleQueryRequest } from "@rocicorp/zero/server"
import { queries } from "@/db/queries"
import { schema } from "@/db/schema"
import { auth } from "@/lib/auth-server"
import type { AuthData } from "@/db/types"

const getAuthContext = async (request: Request): Promise<AuthData> => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return { userID: null }
  }
  return { userID: session.user.id }
}

export const Route = createFileRoute("/api/zero/query")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAuthContext(request)
        const result = await handleQueryRequest(
          (name, args) => mustGetQuery(queries, name).fn({ args, ctx }),
          schema,
          request
        )
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        })
      },
    },
  },
})


