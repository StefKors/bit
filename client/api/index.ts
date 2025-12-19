import { Hono } from "hono";
import type { Context } from "hono";
import { handle } from "hono/vercel";
import { Pool } from "pg";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroNodePg } from "@rocicorp/zero/server/adapters/pg";
import { mutators } from "../src/db/mutators";
import { queries } from "../src/db/queries";
import { schema } from "../src/db/schema";
import type { AuthData } from "../src/db/types";
import { auth } from "./auth";

export const config = {
  runtime: "nodejs",
};

export const app = new Hono().basePath("/api");

const pool = new Pool({
  connectionString: must(process.env.ZERO_UPSTREAM_DB),
});
const dbProvider = zeroNodePg(schema, pool);

const getContext = async (c: Context): Promise<AuthData> => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return { userID: null };
  }
  return { userID: session.user.id };
};

// Mount Better Auth handler for all /api/auth/* routes
app.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw);
});

app.post("/zero/query", async (c) => {
  const ctx = await getContext(c);
  const result = await handleQueryRequest(
    (name, args) => mustGetQuery(queries, name).fn({ args, ctx }),
    schema,
    c.req.raw,
  );
  return c.json(result);
});

app.post("/zero/mutate", async (c) => {
  const ctx = await getContext(c);
  const result = await handleMutateRequest(
    dbProvider,
    (transact) =>
      transact((tx, name, args) => mustGetMutator(mutators, name).fn({ tx, args, ctx })),
    c.req.raw,
  );
  return c.json(result);
});

export default handle(app);

function must<T>(val: T) {
  if (!val) {
    throw new Error("Expected value to be defined");
  }
  return val;
}
