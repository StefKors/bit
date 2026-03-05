<p align="center">
  <h1 align="center">Bit</h1>
</p>

[Bit](https://github.com/StefKors/Bit) — a faster GitHub frontend.

## Features

- **GitHub App Integration**: Connect your GitHub account, install the Bit GitHub App, and enable repos
- **Pull Request Dashboard**: PRs grouped by Draft, Needs Review, and Ready to Merge
- **PR Detail View**: Mergeable status, CI checks, conversation comments, and reviews
- **Real-time Webhooks**: Live updates via GitHub webhooks for PRs, reviews, comments, checks, and pushes
- **Offline-first Sync**: InstantDB powers real-time data sync with offline support
- **Light & Dark Mode**: Adapts to system `prefers-color-scheme`
- Diff viewer component from [pierre](https://diffs.com)

## Setup

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                 | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `BASE_URL`               | Public app URL for webhook callbacks (default: `http://localhost:5173`) |
| `GITHUB_CLIENT_ID`       | GitHub App OAuth client ID                                              |
| `GITHUB_CLIENT_SECRET`   | GitHub App OAuth client secret                                          |
| `GITHUB_APP_SLUG`        | GitHub App slug (used for installation redirect)                        |
| `GITHUB_APP_ID`          | GitHub App ID (for generating JWTs)                                     |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM, newlines escaped as `\n`)                  |
| `GITHUB_WEBHOOK_SECRET`  | Secret for verifying webhook signatures                                 |
| `INSTANT_APP_ID`         | InstantDB app ID                                                        |
| `INSTANT_ADMIN_TOKEN`    | InstantDB admin token                                                   |

### InstantDB Setup

1. Go to [InstantDB Dashboard](https://www.instantdb.com/dash)
2. Create a new app
3. Copy the App ID and generate an Admin Token — add both to `.env`

### GitHub App Setup

1. Go to [GitHub Developer Settings > Apps](https://github.com/settings/apps) and create a new GitHub App
2. Set the **Webhook URL** to `<your-public-url>/api/github/webhook`
3. Generate a **Webhook Secret** and add it as `GITHUB_WEBHOOK_SECRET`
4. Note the **App ID**, **Client ID**, **Client Secret**, and **App slug** — add all to `.env`
5. Generate a **Private Key** and add it as `GITHUB_APP_PRIVATE_KEY`
6. Subscribe to webhook events: Pull requests, Pull request reviews, Pull request review comments, Issue comments, Check runs, Check suites, Push
7. Set permissions: Pull requests (Read), Contents (Read), Metadata (Read), Checks (Read)

### Running the App

```bash
# Install dependencies
bun install

# Push schema and permissions to InstantDB
bun run instant:push

# Start the development server
bun run dev
```

### Production

```bash
bun run build
bun run start
```

The production server runs on port 3000 by default (override with `PORT`).

## Routes

| Route                        | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `/`                          | Home — user profile, GitHub connect flow, list of enabled repos      |
| `/enable-repos`              | Select which repos from your GitHub App installation to enable       |
| `/:owner/:repo`              | Repo overview — PRs grouped by Draft / Needs Review / Ready to Merge |
| `/:owner/:repo/pull/:number` | PR detail — state, checks, comments, reviews                         |

## API Endpoints

| Method | Endpoint                         | Description                                        |
| ------ | -------------------------------- | -------------------------------------------------- |
| GET    | `/api/health`                    | Health check                                       |
| GET    | `/api/github/oauth`              | Redirects to GitHub App installation flow          |
| GET    | `/api/github/oauth/callback`     | Handles GitHub App installation callback           |
| GET    | `/api/github/installation/repos` | Lists repos accessible to the installed GitHub App |
| POST   | `/api/github/repos/enable`       | Enables Bit tracking on selected repos             |
| POST   | `/api/github/webhook`            | Receives and processes GitHub webhook events       |

## Tech Stack

| Layer                 | Technology                                |
| --------------------- | ----------------------------------------- |
| **Frontend**          | React 19, TypeScript, Vite 7              |
| **Routing**           | TanStack Router + TanStack Start          |
| **Database / State**  | InstantDB (offline-first, real-time sync) |
| **Styling**           | CSS Modules with CSS variables            |
| **UI Components**     | Base UI, cmdk, Primer Octicons            |
| **Backend**           | TanStack Start (Nitro), Hono              |
| **Auth**              | InstantDB magic-code auth + GitHub App    |
| **GitHub**            | Octokit, `@octokit/webhooks-types`        |
| **Code Highlighting** | Shiki, markdown-it                        |
| **Validation**        | Zod                                       |

## Development

```bash
# Lint (required before committing)
bun run lint

# Format
bun run format

# Run tests
bun run test
```
