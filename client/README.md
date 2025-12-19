# Hello Zero

## Option 1: Run this repo

First, install dependencies:

```sh
npm i
```

Next, run docker:

```sh
npm run dev:db-up
```

**In a second terminal**, run the zero cache server:

```sh
npm run dev:zero-cache
```

**In a third terminal**, run the Vite dev server:

```sh
npm run dev:ui
```

## Option 2: Install Zero in your own project

This guide explains how to set up Zero in your React application, using this
repository as a reference implementation.

### Prerequisites

**1. PostgreSQL database with Write-Ahead Logging (WAL) enabled**

See [Connecting to Postgres](https://zero.rocicorp.dev/docs/connecting-to-postgres)

**2. Environment Variables**

Set the following environment variables. `ZSTART_UPSTREAM_DB` is the URL to your Postgres
database.

```ini
# Your application's data
ZERO_UPSTREAM_DB="postgresql://user:password@127.0.0.1/mydb"

# Secret to decode auth token.
ZERO_AUTH_SECRET="secretkey"

# Place to store sqlite replica file.
ZERO_REPLICA_FILE="/tmp/zstart_replica.db"

# Where UI will connect to zero-cache.
VITE_PUBLIC_SERVER=http://localhost:4848
```

### Setup

1. **Install Zero**

```bash
npm install @rocicorp/zero
```

2. **Create Schema** Define your database schema using Zero's schema builder.
   See [schema.ts](src/schema.ts) for example:

```typescript
import { createSchema, table, string } from "@rocicorp/zero";

const user = table("user")
  .columns({
    id: string(),
    name: string(),
  })
  .primaryKey("id");

export const schema = createSchema({
  tables: [user],
});

export type Schema = typeof schema;
```

3. **Initialize Zero Client-Side** Set up the Zero provider in your app entry
   point. See [main.tsx](src/main.tsx):

```tsx
import { Zero } from "@rocicorp/zero";
import { ZeroProvider } from "@rocicorp/zero/react";
import { schema } from "./schema";

// In a real app, you might initialize this inside of useMemo
// and use a real auth token
const z = new Zero({
  userID: "your-user-id",
  auth: "your-auth-token",
  server: import.meta.env.VITE_PUBLIC_SERVER,
  schema,
});

createRoot(document.getElementById("root")!).render(
  <ZeroProvider zero={z}>
    <App />
  </ZeroProvider>
);
```

4. **Using Zero in Components** Example usage in React components. See
   [App.tsx](src/App.tsx):

```typescript
import { useQuery, useZero } from "@rocicorp/zero/react";
import { Schema } from "./schema";

// You may want to put this in its own file
const useZ = useZero<Schema>;

export function UsersPage() {
  const z = useZ();
  const users = useQuery(z.query.user);

  if (!users) {
    return null;
  }

  // Use the data...
  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

For more examples of queries, mutations, and relationships, explore the
[App.tsx](src/App.tsx) file in this repository.

### Authentication with GitHub OAuth

This example includes GitHub OAuth authentication using Better Auth. To enable:

1. **Create a GitHub OAuth App:**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Set the callback URL to: `http://localhost:5173/api/auth/callback/github`
   - Note your Client ID and Client Secret

2. **Add to your `.env` file:**
   ```ini
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```

3. **Push the auth tables to your database:**
   ```bash
   npm run db:push
   ```

The auth implementation uses Better Auth with Drizzle ORM. See:
- [api/auth.ts](api/auth.ts) - Server-side auth configuration
- [src/lib/auth.ts](src/lib/auth.ts) - Client-side auth hooks
- [db/schema.ts](db/schema.ts) - Auth database schema

### Development

**1. Start the PostgreSQL database:**

If you are using Docker (referencing the example in
[docker](docker/docker-compose.yml)), run:

```bash
npm run dev:db-up
```

**2. Start the zero cache server (in a separate terminal):**

```bash
npx zero-cache
```

**3. Start your React dev server**

```bash
npm run dev # this depends on your react app setup
```
