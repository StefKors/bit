import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"

dotenv.config()

export default defineConfig({
  schema: "./schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.ZERO_UPSTREAM_DB!,
  },
})
