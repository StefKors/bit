# React

- Prefer arrow functions.
- Make separate components when mapping data.
- Find reusable code and make components from them.
- Reuse existing components
- Use css modules
- Use queries with related over doing multiple fetches
- each file should contain 1 main component. avoid creating multiple large components in the same file.
- Prefer **1 `useQuery(...)` per page**. Expand all page data from a single root query via `.related(...)` instead of adding more `useQuery` calls in subcomponents/tabs.

# TanStack Router

- Links with dynamic parameters use the `params` prop:
  ```tsx
  <Link
    to="/somewhere/$somewhereId"
    params={{ somewhereId: 'baz' }}
  />
  ```

# Zero (queries + mutations)

- Queries live in `src/db/queries.ts` and should be composed using ZQL (`zql` from `src/db/schema.ts`) + `.related(...)`.
- `.related(...)` only works once the generated Zero schema has relationships.
  - Right now `src/db/schema.ts` has `relationships: {}`.
  - Add Drizzle `relations(...)` in the root `schema.ts`, then regenerate: `npm run generate-zero-schema`.
- Prefer `.one()` for detail pages (repo detail, PR detail) and do ordering/filtering inside the query.

## Database Defaults

**Do NOT use Drizzle database defaults with Zero.** This includes:

- `.default()` - e.g., `.default(false)`, `.default(0)`
- `.defaultNow()` - for timestamps
- `.$onUpdate()` - auto-update triggers

**Why**: Zero mutations run locally first before the server replays them. The local database doesn't know about Postgres defaults, so fields would be `null`/`undefined` until the server fills them in.

**Solution**: Set all values explicitly in mutators and sync code. The sync endpoints and webhook handlers must provide every value when inserting/upserting rows.

See: https://github.com/rocicorp/drizzle-zero/issues/197

## Mutators

- Mutators live in `src/db/mutators.ts`.
  - Define with `defineMutators(...)` + `defineMutator(...)` and validate args with Zod.
  - Write using `tx.mutate.<table>.<insert|upsert|update|delete>(...)` and use `ctx.userID` for authz.
  - This repo has `schema.enableLegacyMutators = false`, so call custom mutators like:
    - `const zero = useZero(); await zero.mutate(mutators.foo.bar(args))`

# CSS

- Use CSS variables from `theme.css`

# Formatting

- Run `bun run format` after making changes to ensure consistent code style
- The project uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for formatting TypeScript/JavaScript files
- VS Code is configured to format on save via the `oxc.oxc-vscode` extension

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

- do not consider local state truthful when interacting with server. when interacting with the server with rpc or api calls never use state from the render function as input for the api call. this state can easily become stale or not get updated in the closure context. instead prefer using zustand `useStore.getState().stateValue`. notice that useLoaderData or useParams should be fine in this case.

- when using useRef with a generic type always add undefined in the call, for example `useRef<number>(undefined)`. this is required by the react types definitions

- when using && in jsx make sure that the result type is not of type number. in that case add Boolean() wrapper. this way jsx will not show zeros when the value is falsy.

## components

- place new components in the src/components folder. shadcn components will go to the src/components/ui folder, usually they are not manually updated but added with the shadcn cli (which is preferred to be run without npx, either with pnpm or globally just shadcn)

- component filenames should follow kebab case structure

- do not create a new component file if this new code will only be used in another component file. only create a component file if the component is used by multiple components or routes. colocate related components in the same file.

- non component code should be put in the src/lib folder.

- hooks should be put in the src/hooks.tsx file. do not create a new file for each new hook. also notice that you should never create custom hooks, only do it if asked for.

## non controlled input components

some components do not have a value prop to set the value via React state. these are called uncontrolled components. Instead they usually let you get the current input value via ref. something like ref.current.value. They usually also have an onChange prop that let you know when the value changes

these usually have a initialValue or defaultValue to programmatically set the initial value of the input

when using these components you SHOULD not track their state via React: instead you should programmatically set their value and read their value via refs in event handlers

tracking uncontrolled inputs via React state means that you will need to add useEffect to programmatically change their value when our state changes. this is an anti pattern. instead you MUST keep in mind the uncontrolled input manages its own state and we interface with it via refs and initialValue prop.

using React state in these cases is only necessary if you have to show the input value during render. if that is not the case you can just use `inputRef.current.value` instead and set the value via `inputRef.current.value = something`

---

# GitHub Webhooks

Webhook handlers live in `src/lib/webhooks/` with each event type in its own file:

- `pull-request.ts` - handles `pull_request` events
- `pull-request-review.ts` - handles `pull_request_review` events
- `comment.ts` - handles `issue_comment` and `pull_request_review_comment` events
- `push.ts` - handles `push` events (updates repo activity timestamp, syncs commits to open PRs)
- `utils.ts` - shared utilities for auto-tracking resources
- `types.ts` - shared TypeScript types (re-exports `@octokit/webhooks-types`)

The route handler at `src/routes/api/github/webhook.ts` receives webhooks, verifies signatures, and dispatches to the appropriate handler.

## Webhook Event Implementation Status

The webhook handler has stubs for **all GitHub webhook events**. Events are categorized as:

### Fully Implemented

| Event                         | Handler                  | Description                                                  |
| ----------------------------- | ------------------------ | ------------------------------------------------------------ |
| `pull_request`                | `pull-request.ts`        | PR opened/closed/updated/merged                              |
| `pull_request_review`         | `pull-request-review.ts` | Review submitted/dismissed                                   |
| `pull_request_review_comment` | `comment.ts`             | Inline diff comments                                         |
| `issue_comment`               | `comment.ts`             | PR conversation comments                                     |
| `push`                        | `push.ts`                | Updates `githubPushedAt` on repos, syncs commits to open PRs |
| `ping`                        | (inline)                 | Webhook configuration test                                   |

### Stubbed - Implement When Adding Features

**Issues Feature** (implement when issues tab is built):

- `issues` - Issue opened/closed/labeled/assigned

**CI/CD Feature** (implement for PR status checks):

- `check_run`, `check_suite` - CI check status
- `status` - Commit status
- `workflow_run`, `workflow_job` - GitHub Actions

**Security Dashboard Feature**:

- `code_scanning_alert`, `dependabot_alert`, `secret_scanning_alert`

**Releases Feature**:

- `release` - Release published/edited

**Full event list**: See the switch statement in `src/routes/api/github/webhook.ts`

## Auto-tracking behavior

All webhook handlers support **auto-tracking**. When a webhook event arrives:

1. **Resource already tracked** → Updates existing records for all users tracking it
2. **Not tracked but sender is registered** → Auto-creates repo/PR records under that user
3. **Sender not registered** → Logs and skips (no data stored)

This means users automatically receive updates for repos they interact with via GitHub, even if they haven't explicitly synced those repos in the app.

## Adding/Updating Webhook Handlers

When adding a new feature that requires webhook data:

1. **Identify relevant events**: Check which GitHub events provide the data you need
   - Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads
2. **Create handler file**: `src/lib/webhooks/{event-name}.ts`
3. **Use typed payloads**: Import types from `@octokit/webhooks-types` via `./types.ts`
4. **Export from index**: Add export to `src/lib/webhooks/index.ts`
5. **Replace stub**: Change the stub in `webhook.ts` to call your handler
6. **Follow auto-tracking pattern**: Use `findUserBySender`, `ensureRepoFromWebhook`, etc.
7. **Update this doc**: Mark the event as "Fully Implemented" above

### Handler function signature

```typescript
import type { WebhookDB, WebhookPayload, SomeEvent } from "./types"

async function handleSomeWebhook(
  db: WebhookDB,
  payload: WebhookPayload,
  // optional extra params like eventType for comment handler
): Promise<void> {
  // Cast to typed payload for autocomplete
  const typedPayload = payload as unknown as SomeEvent
  // ... implementation
}
```

### Mapping features to webhook events

| Feature     | Events to Implement                       |
| ----------- | ----------------------------------------- |
| Issues      | `issues`                                  |
| CI Status   | `check_run`, `check_suite`, `status`      |
| Releases    | `release`                                 |
| Discussions | `discussion`, `discussion_comment`        |
| Security    | `code_scanning_alert`, `dependabot_alert` |
| Stars/Forks | `star`, `fork`                            |

## Environment variables

- `GITHUB_WEBHOOK_SECRET` - Secret for verifying webhook signatures (required)
- `ZERO_UPSTREAM_DB` - PostgreSQL connection string for database operations
