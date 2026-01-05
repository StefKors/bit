import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "../../../../schema"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const db = drizzle(pool, { schema })

export const auth = betterAuth({
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
  trustedOrigins: [process.env.BASE_URL!, "https://bit.stefkors.com"],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      redirectURI: `${process.env.BASE_URL}/api/auth/callback/github`,
      // Required scopes for GitHub integration:
      // - read:org: list user's organizations
      // - repo: access repositories (including private) and pull requests
      // - read:user: basic user profile info
      // - user:email: access user's email addresses
      scope: ["read:org", "repo", "read:user", "user:email"],
    },
  },
})


