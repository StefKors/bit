import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import {
  createBuilder,
  createSchema,
  Row,
  table,
  string,
  boolean as zeroBoolean,
} from "@rocicorp/zero";

// =============================================================================
// Drizzle Schema (Better Auth tables)
// =============================================================================

export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const authSession = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_userId_idx").on(table.userId)],
);

export const authAccount = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_account_userId_idx").on(table.userId)],
);

export const authVerification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

// =============================================================================
// Zero Schema (Client-side sync)
// =============================================================================

const user = table("user")
  .columns({
    id: string(),
    name: string(),
    partner: zeroBoolean(),
  })
  .primaryKey("id");

export const schema = createSchema({
  tables: [user],
  relationships: [],
  enableLegacyQueries: false,
  enableLegacyMutators: false,
});

export const zql = createBuilder(schema);

export type Schema = typeof schema;
export type User = Row<typeof schema.tables.user>;

export type AuthData = {
  userID: string | null;
};

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: Schema;
    context: AuthData;
  }
}
