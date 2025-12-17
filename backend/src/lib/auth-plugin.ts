import { Elysia } from "elysia"
import { auth } from "../db/auth"

/**
 * Elysia plugin that provides auth context via macro
 *
 * Usage:
 * ```ts
 * app.use(betterAuthPlugin)
 *    .get("/protected", ({ user }) => user, { auth: true })
 * ```
 */
export const betterAuthPlugin = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers })

      if (!session) {
        return status(401)
      }

      return {
        user: session.user,
        session: session.session,
      }
    },
  },
})

