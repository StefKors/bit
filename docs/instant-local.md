# InstantDB Local Export

Snapshot the current database state to work offline (e.g. on a plane).

## Commands

```bash
# Export once
bun run instant:export

# Refresh local snapshot with latest data
bun run instant:update-local
```

Both commands write to `instant-local/db.json`.

## Prerequisites

- `INSTANT_ADMIN_TOKEN` in `.env`
- Internet connection (to fetch from InstantDB)

## Output

- **Path:** `instant-local/db.json`
- **Contents:** Repos, pull requests, reviews, comments, checks, and related data
- **Format:** JSON with `exportedAt` timestamp and `data` payload

## Git

`instant-local/` is in `.gitignore` and is not committed.

## Offline app behavior

The export is a backup. The app does not load from it automatically. To use the app offline:

1. Open the app while online and visit the PR overview pages you need.
2. InstantDB caches recent queries (default: 10). Cached data is available offline.
3. To cache more views, increase `queryCacheLimit` in `src/lib/instantDb.ts`.
