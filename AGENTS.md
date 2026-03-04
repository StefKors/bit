# React

- Prefer arrow functions.
- Make separate components when mapping data.
- Find reusable code and make components from them.
- Reuse existing components
- Use CSS modules
- Use `db.useQuery()` with nested relations over doing multiple fetches
- each file should contain 1 main component. avoid creating multiple large components in the same file.
- Prefer **1 `db.useQuery(...)` per page**. Expand all page data from a single root query via nested relations instead of adding more `useQuery` calls in subcomponents/tabs.

# TanStack Router

- Links with dynamic parameters use the `params` prop:
  ```tsx
  <Link to="/somewhere/$somewhereId" params={{ somewhereId: "baz" }} />
  ```

# InstantDB (queries + mutations)

- Schema lives in `src/instant.schema.ts`
- Permissions live in `src/instant.perms.ts`
- Client SDK initialized in `src/lib/instantDb.ts`
- Admin SDK initialized in `src/lib/instantAdmin.ts`

## Queries

```typescript
import { db } from "@/lib/instantDb"

// In components, use db.useQuery()
const { data, isLoading, error } = db.useQuery({
  repos: {
    $: { where: { owner: "user" }, orderBy: { name: "asc" } },
    pullRequests: {},
    issues: {},
  },
})
```

## Mutations (Admin SDK)

```typescript
import { adminDb } from "@/lib/instantAdmin"

// Insert/update using transact
await adminDb.transact(
  adminDb.tx.repos[nodeId].update({
    name: repo.name,
    fullName: repo.full_name,
    // ... all fields
  }),
)
```

## Schema Changes

After modifying `src/instant.schema.ts`:

```bash
bun run instant:push:schema
```

After modifying `src/instant.perms.ts`:

```bash
bun run instant:push:perms
```

Or push both:

```bash
bun run instant:push
```

# CSS

- Use CSS variables from `src/theme.css` (all prefixed with `--bit-`)

# Formatting

- Run `bun run format` after making changes to ensure consistent code style
- The project uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for formatting TypeScript/JavaScript files
- VS Code is configured to format on save via the `oxc.oxc-vscode` extension
- **Always run `bun run lint` before committing.** Fix any lint errors before staging and committing.

# react

- never test react code. instead put as much code as possible in react-agnostic functions or classes and test those if needed.

- hooks, all functions that start with use, MUST ALWAYS be called in the component render scope, never inside other closures in the component or event handlers. follow react rules of hooks.

- always put all hooks at the start of component functions. put hooks that are bigger and longer later if possible. all other non-hooks logic should go after hooks section, things like conditionals, expressions, etc

## react code

- `useEffect` is bad: the use of useEffect is discouraged. please do not use it unless strictly necessary. before using useEffect call the @think tool to make sure that there are no other options. usually you can colocate code that runs inside useEffect to the functions that call that useEffect dependencies setState instead

- too many `useState` calls are bad. if some piece of state is dependent on other state just compute it as an expression in render. do not add new state unless strictly necessary. before adding a new useState to a component, use @think tool to think hard if you can instead: use expression with already existing local state, use expression with some global state, use expression with loader data, use expression with some other existing variable instead. for example if you need to show a popover when there is an error you should use the error as open state for the popover instead of adding new useState hook

- `useCallback` is bad. it should be always avoided unless for ref props. ref props ALWAYS need to be passed memoized functions or the component could remount on ever render!

- NEVER pass functions to useEffect or useMemo dependencies. when you start passing functions to hook dependencies you need to add useCallback everywhere in the code, useCallback is a virus that infects the codebase and should be ALWAYS avoided.

- custom hooks are bad. NEVER add custom hooks unless asked to do so by me. instead of creating hooks create generic react-independent functions. every time you find yourself creating a custom hook call @think and think hard if you can just create a normal function instead, or just inline the expression in the component if small enough

- minimize number of props. do not use props if you can help it.

- do not consider local state truthful when interacting with server. when interacting with the server with rpc or api calls never use state from the render function as input for the api call. this state can easily become stale or not get updated in the closure context. instead prefer reading values from useLoaderData, useParams, or refs.

- when using useRef with a generic type always add undefined in the call, for example `useRef<number>(undefined)`. this is required by the react types definitions

- when using && in jsx make sure that the result type is not of type number. in that case add Boolean() wrapper. this way jsx will not show zeros when the value is falsy.

## components

- place new components in the src/components folder.

- component filenames should follow kebab case structure

- do not create a new component file if this new code will only be used in another component file. only create a component file if the component is used by multiple components or routes. colocate related components in the same file.

- non component code should be put in the src/lib folder.

- hooks should be put in the `src/lib/hooks/` folder. do not create a new file for each new hook. also notice that you should never create custom hooks, only do it if asked for.

## non controlled input components

some components do not have a value prop to set the value via React state. these are called uncontrolled components. Instead they usually let you get the current input value via ref. something like ref.current.value. They usually also have an onChange prop that let you know when the value changes

these usually have a initialValue or defaultValue to programmatically set the initial value of the input

when using these components you SHOULD not track their state via React: instead you should programmatically set their value and read their value via refs in event handlers

tracking uncontrolled inputs via React state means that you will need to add useEffect to programmatically change their value when our state changes. this is an anti pattern. instead you MUST keep in mind the uncontrolled input manages its own state and we interface with it via refs and initialValue prop.

using React state in these cases is only necessary if you have to show the input value during render. if that is not the case you can just use `inputRef.current.value` instead and set the value via `inputRef.current.value = something`

---

# GitHub Webhooks

Webhook processing is split across three files:

- `src/routes/api/github/webhook.ts` - Route handler: receives webhooks, verifies signatures, validates payload, dispatches to persistence
- `src/lib/webhook-persistence.ts` - Persistence logic: routes events to entity-specific upsert functions
- `src/lib/webhook-validation.ts` - Validation: Zod schemas for webhook headers and payloads

## Architecture

The webhook route handler (`webhook.ts`):
1. Verifies the `x-hub-signature-256` HMAC signature
2. Validates payload shape via `validateWebhookPayload` (Zod)
3. Calls `persistWebhookPayloadSafely` which dispatches by event type
4. Returns `{ received: true }`

Event-specific logic lives in `persistWebhookPayload` in `webhook-persistence.ts`, which matches on the `event` string and calls the appropriate upsert function.

## Implemented Events

| Event                         | What it does                                              |
| ----------------------------- | --------------------------------------------------------- |
| `push`                        | Updates `pushedAt` on repos, creates/updates `pushEvents` |
| `pull_request`                | Upserts pull request records                              |
| `pull_request_review`         | Upserts PR review records                                 |
| `pull_request_review_comment` | Upserts PR review comment records                         |
| `issue_comment`               | Upserts issue comment records                             |
| `pull_request_review_thread`  | Upserts review thread records                             |
| `check_run`                   | Upserts check run records                                 |
| `check_suite`                 | Upserts check suite records                               |
| `ping`                        | Logs confirmation (no persistence)                        |

## Persistence pattern

All persistence functions follow the same pattern:
1. Look up the repo by `repository.full_name` from the payload
2. If repo not found in DB, skip (only process events for tracked repos)
3. For PR-related events, upsert the pull request first via `upsertPullRequestFromPayload`
4. Then upsert the specific entity (review, comment, check run, etc.)

Payloads are handled as `JsonObject` (a recursive JSON type) with defensive accessor helpers (`asString`, `asNumber`, `asBoolean`, `asObject`, `asArray`, `parseTimestamp`).

## Environment variables

- `GITHUB_WEBHOOK_SECRET` - Secret for verifying webhook signatures (required)
- `INSTANT_APP_ID` - InstantDB app ID
- `INSTANT_ADMIN_TOKEN` - InstantDB admin token for server-side operations
