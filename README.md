# Bit Client

A GitHub-like PR viewer with real-time sync via Rocicorp Zero.

## Features

- **GitHub Integration**: View your organizations, repositories, and pull requests
- **Real-time Sync**: Data syncs via Zero for offline access
- **PR Viewer**: Full PR detail view with conversation, files changed, and diff viewer
- **Webhook Support**: Real-time updates via GitHub webhooks

## Setup

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5432/database

# GitHub OAuth (via Better Auth)
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# GitHub Webhook Secret (for real-time updates)
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Zero Cache URL
VITE_PUBLIC_ZERO_CACHE_URL=http://localhost:4848
```

### GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Homepage URL to `http://localhost:5173`
4. Set Authorization callback URL to `http://localhost:5173/api/auth/callback/github`
5. Copy the Client ID and Client Secret to your `.env` file

**Required OAuth Scopes** (configured automatically):

- `read:org` - List user's organizations
- `repo` - Access repositories (including private) and pull requests
- `read:user` - Basic user profile info
- `user:email` - Access user's email addresses

> **Note**: If you previously logged in with limited scopes, you need to **sign out and sign back in** for the new scopes to take effect.

### GitHub App Setup (for Webhooks)

To receive real-time updates, create a GitHub App:

1. Go to [GitHub Apps](https://github.com/settings/apps)
2. Create a new GitHub App
3. Set the Webhook URL to your API endpoint (e.g., `https://your-domain.com/api/github/webhook`)
4. Generate a Webhook Secret and add it to your `.env` as `GITHUB_WEBHOOK_SECRET`
5. Subscribe to events:
   - Pull requests
   - Pull request reviews
   - Pull request review comments
   - Issue comments
6. Set required permissions:
   - Pull requests: Read
   - Contents: Read
   - Metadata: Read

### Running the App

```bash
# Install dependencies
bun install

# Start the database
bun run dev:db-up

# Run the development server
bun run dev
```

## Routes

| Route                        | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `/`                          | Overview page - list of organizations and repositories |
| `/:owner/:repo`              | Repository home page                                   |
| `/:owner/:repo/pulls`        | Pull request list                                      |
| `/:owner/:repo/pull/:number` | Pull request detail view                               |

## API Endpoints

### Sync Endpoints

- `POST /api/github/sync/overview` - Sync organizations and repositories
- `POST /api/github/sync/:owner/:repo` - Sync pull requests for a repository
- `POST /api/github/sync/:owner/:repo/pull/:number` - Sync PR details (files, comments, reviews)
- `GET /api/github/rate-limit` - Get current GitHub API rate limit status

### Webhook Endpoint

- `POST /api/github/webhook` - Receive GitHub webhook events

## Rate Limiting

GitHub API has a limit of 5000 requests per hour for authenticated users. The app:

- Tracks remaining requests and displays them in the UI
- Shows a warning when rate limit is low (<100 requests)
- Stores sync state to avoid unnecessary re-fetching

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Routing**: wouter
- **State**: Rocicorp Zero (offline-first sync)
- **Styling**: CSS Modules
- **Backend**: Hono
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth with GitHub OAuth
