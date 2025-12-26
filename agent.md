## Zero queries & mutations (agent instructions)

This project uses **Rocicorp Zero** for queries + offline-first sync.

- **Queries live in**: `src/db/queries.ts`
- **Mutators live in**: `src/db/mutators.ts`
- **Zero schema is generated at**: `src/db/schema.ts` (do not edit by hand)
- **Query + mutation endpoints**: `api/index.ts` (`POST /api/zero/query`, `POST /api/zero/mutate`)

### Queries (how to structure)

- **One page = one query**: each route/page component should call `useQuery(...)` **exactly once** for its primary data.
- **That one query should include all needed page data** using `.related(...)` expansions from a single “root” table.
- **No “helper queries” sprinkled in tabs/components**. If a tab needs extra data, add it to the page query via `.related`.

Why:

- **Single consistent snapshot**: the page renders from one transactional result.
- **Fewer subscriptions**: fewer live views → fewer updates and less churn.
- **Clear ownership**: the page’s query is the contract for the page.

### Where `.related(...)` comes from

`.related("…")` only works if the **generated Zero schema** has relationships.

In this repo, `src/db/schema.ts` currently has `relationships: {}`. That means:

- `.related(...)` will **not typecheck / not be available** until relationships are defined.

To enable `.related(...)`:

- **Define Drizzle relations** in the root `schema.ts` using `relations(...)` from `drizzle-orm`.
- **Regenerate** the Zero schema:

```bash
npm run generate-zero-schema
```

After regeneration, `src/db/schema.ts` should contain `relationships` entries, and `.related(...)` becomes available on ZQL queries.

### How to write a “page query”

All queries are defined with `defineQueries(...)` + `defineQuery(...)` and built from `zql`:

- `zql` is the ZQL builder from `src/db/schema.ts`
- query args are validated (use Zod; Zod v4 implements Standard Schema)

Example shape (root row + related collections):

```ts
// src/db/queries.ts (example)
import {defineQueries, defineQuery} from '@rocicorp/zero';
import {zql} from './schema';
import z from 'zod';

export const queries = defineQueries({
  repoPage: defineQuery(
    z.object({fullName: z.string()}),
    ({args}) =>
      zql.githubRepo
        .where('fullName', '=', args.fullName)
        .one()
        .related('pullRequests', q => q.orderBy('githubUpdatedAt', 'desc')),
  ),
});
```

UI usage (one `useQuery`):

```ts
import {useQuery} from '@rocicorp/zero/react';
import {queries} from '@/db/queries';

const [repo] = useQuery(queries.repoPage({fullName}));
// repo?.pullRequests is available because the query expanded it via .related(...)
```

### Rules for page queries

- **Pick a single root**:
  - Repo pages: root = `githubRepo.one()`
  - PR detail: root = `githubPullRequest.one()`
  - Overview: root should be a row that can relate to both orgs + repos (often `authUser.one()`), or introduce a proper relation path.
- **Do ordering/filters inside the query**, not in render, unless it’s trivial UI-only formatting.
- **Prefer `.one()`** when you need a single record (repo detail, PR detail).
- **No N+1 UI queries**: if you need per-row related data, expand it via `.related(...)` on the parent query.

### If you can’t make it one query (yet)

If the data you need has no relationship path, **add relationships** (preferred) rather than adding more `useQuery` calls.

If you truly cannot relate two datasets:

- keep extra queries **temporary**
- leave a TODO to add the missing relationship so the page can return to **one query**

---

## Mutations (custom mutators)

Mutations in Zero are **mutators**.

### Define a mutator

Add mutators in `src/db/mutators.ts` using `defineMutators` + `defineMutator`.

Mutator signature:

- receives `{tx, args, ctx}`
- returns `Promise<void>`
- should use `ctx.userID` for authz
- should write via `tx.mutate.<table>.<insert|upsert|update|delete>(...)`

Example:

```ts
// src/db/mutators.ts (example)
import {defineMutators, defineMutator} from '@rocicorp/zero';
import z from 'zod';

export const mutators = defineMutators({
  users: {
    setPartner: defineMutator(
      z.object({id: z.string(), partner: z.boolean()}),
      async ({tx, args, ctx}) => {
        if (!ctx.userID) throw new Error('Unauthorized');

        // Example update (table names come from src/db/schema.ts)
        await tx.mutate.user.update({
          id: args.id,
          partner: args.partner,
        });
      },
    ),
  },
});
```

### Call a mutator from the UI

This project has `schema.enableLegacyMutators = false`, so **do not** use `zero.mutate.someMutator(...)`.

Instead:

```ts
import {useZero} from '@rocicorp/zero/react';
import {mutators} from '@/db/mutators';

const zero = useZero();
await zero.mutate(mutators.users.setPartner({id, partner: true}));
```

### Server-side execution

The server automatically routes mutations through `api/index.ts` using the same `mutators` registry:

- `POST /api/zero/mutate` looks up mutators by name and runs them with `{tx, args, ctx}`.

So: **adding a mutator to `src/db/mutators.ts` is enough** (no extra API route needed), as long as the UI calls it via `zero.mutate(...)`.

