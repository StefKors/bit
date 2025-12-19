import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "../db/schema"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const db = drizzle(pool, { schema })

export const auth = betterAuth({
  baseURL: "http://localhost:5173",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Map Better Auth tables to our prefixed table names
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  }),
  trustedOrigins: ["http://localhost:5173"],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      redirectURI: "http://localhost:5173/api/auth/callback/github",
    },
  },
})
