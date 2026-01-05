import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { mustGetMutator } from "@rocicorp/zero"
import { handleMutateRequest } from "@rocicorp/zero/server"
import { zeroNodePg } from "@rocicorp/zero/server/adapters/pg"
import { mutators } from "@/db/mutators"
import { schema } from "@/db/schema"
import { auth } from "@/lib/auth-server"
import type { AuthData } from "@/db/types"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const dbProvider = zeroNodePg(schema, pool)

const getAuthContext = async (request: Request): Promise<AuthData> => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return { userID: null }
  }
  return { userID: session.user.id }
}

export const Route = createFileRoute("/api/zero/mutate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAuthContext(request)
        const result = await handleMutateRequest(
          dbProvider,
          (transact) =>
            // @ts-expect-error - mutators is empty but Zero requires this endpoint
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            transact((tx, name, args) => mustGetMutator(mutators, name).fn({ tx, args, ctx })),
          request
        )
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        })
      },
    },
  },
})


