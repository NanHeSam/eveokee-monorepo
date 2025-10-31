# AGENTS.md

## Quick Start
- Install dependencies at the repo root with `pnpm install`.
- Start the Convex dev server via `pnpm dev:convex` (root) or `pnpm --filter @backend/convex dev`; it watches `convex/`.
- Deploy with `pnpm --filter @backend/convex deploy` once changes are validated.
- Regenerate types automatically by running the dev server; avoid editing files under `convex/_generated/`.

## Scripts
- `pnpm --filter @backend/convex dev` — Runs `npx convex dev` locally.
- `pnpm --filter @backend/convex deploy` — Publishes functions to the configured Convex project (requires `CONVEX_DEPLOY_KEY`).
- `pnpm test:backend` or `pnpm --filter @backend/convex test` — Vitest suite.
- `pnpm --filter @backend/convex test:watch` — Interactive Vitest mode.
- Type checking defers to Convex runtime types; no dedicated `tsc` step is provided.

## Testing Guidance
- Use the shared `createMockCtx` helper from `__tests__/testUtils.ts` to stub mutation/query contexts.
- Keep tests under `__tests__/` at the package root (not inside `convex/` to avoid deployment); follow the naming convention `<module>.test.ts`.
- Mock third-party APIs (OpenAI, Clerk, Svix, RevenueCat, Suno, VAPI) and timers—do not hit external services during tests.
- When covering actions with side effects (`emailNotify`, `musicActions`, webhooks), assert on mocked clients rather than Convex logs.
- Tests use Vitest with the `edge-runtime` environment for Convex compatibility.

## Architecture Overview

### Core Modules
- **Schema** (`convex/schema.ts`) — Database schema definitions for all tables (users, diaries, music, subscriptionStatuses, callSettings, callJobs, callSessions, etc.). Run `convex dev` after schema changes to refresh generated API bindings.

### Public Endpoints
Public queries/mutations/actions are organized by domain:
- `convex/users.ts` — User management and authentication
- `convex/diaries.ts` — Diary entry operations
- `convex/music.ts` — Music generation and retrieval queries
- `convex/musicActions.ts` — Music generation actions (async, calls external APIs)
- `convex/sharing.ts` — Shareable music links
- `convex/billing.ts` — Subscription and billing operations
- `convex/revenueCatBilling.ts` — RevenueCat subscription reconciliation
- `convex/callSettings.ts` — Phone call scheduling configuration
- `convex/callJobs.ts` — Scheduled call job management
- `convex/callDiaryWorkflow.ts` — Workflow for creating diaries from phone calls
- `convex/usage.ts` — Usage tracking and limits
- `convex/deleteAccount.ts` — Account deletion

### HTTP Endpoints
- `convex/http.ts` — HTTP router definition and route registration (must be at top level per Convex guidelines).
- HTTP routes are defined in `convex/http.ts` and route to handlers in `convex/webhooks/handlers/`:
  - Clerk webhooks (`clerk.ts`)
  - RevenueCat webhooks (`revenuecat.ts`)
  - Suno callbacks (`suno.ts`)
  - VAPI webhooks (`vapi.ts`)

### Integrations
Third-party client wrappers live in `convex/integrations/`:
- `convex/integrations/openai/client.ts` — OpenAI API client
- `convex/integrations/suno/client.ts` — Suno API client
- `convex/integrations/revenuecat/client.ts` — RevenueCat API client
- `convex/integrations/vapi/client.ts` — VAPI API client
- `convex/integrations/vapi/integration.ts` — VAPI integration helpers
- `convex/integrations/vapi/helpers.ts` — VAPI utility functions
- `convex/integrations/vapi/systemPrompt.ts` — VAPI system prompt configuration

### Services
Background services in `convex/service/`:
- `convex/service/vapi/executor.ts` — Executes scheduled VAPI calls (called by cron)

### Models
Data models for webhooks in `convex/models/webhooks/`:
- `convex/models/webhooks/clerk.ts` — Clerk webhook payload types
- `convex/models/webhooks/revenuecat.ts` — RevenueCat webhook payload types
- `convex/models/webhooks/suno.ts` — Suno callback payload types
- `convex/models/webhooks/vapi.ts` — VAPI webhook payload types
- `convex/models/webhooks/index.ts` — Central export

### Utilities
Shared utilities in `convex/utils/`:
- `convex/utils/constants/` — Organized constant exports (general, music, plans, query, revenuecat, sharing, vapi, webhooks)
- `convex/utils/logger.ts` — Structured logging utility
- `convex/utils/cadenceHelpers.ts` — Phone call cadence calculation helpers
- `convex/utils/phoneHelpers.ts` — Phone number formatting and validation
- `convex/utils/timezoneHelpers.ts` — Timezone conversion utilities

### Scheduled Jobs
- `convex/crons.ts` — Cron job definitions:
  - VAPI call executor (runs every minute)
  - RevenueCat subscription reconciliation (runs daily at midnight UTC)

## Implementation Notes
- `convex/index.ts` exports `api`, `internal`, and type helpers (`Doc`, `Id`) from generated files.
- When adding new functions, they are automatically discovered by Convex's file-based routing. No manual registration needed.
- Keep handlers pure where possible; surface I/O through injected clients passed via context or use actions for external API calls.
- HTTP endpoints (`convex/http.ts`) should validate payloads defensively; mirror changes in clients and tests.
- Actions (e.g., `musicActions.ts`) handle external API calls; mutations/queries handle database operations.
- Use `internal` functions for private operations that shouldn't be exposed to clients.

## Environment & Secrets
- Local dev uses `.env.local` picked up by Convex CLI; ensure required secrets are available before calling dependent functions.
- Production deploys require the `CONVEX_DEPLOY_KEY`; coordinate with ops before rotating keys or adding new secrets.
- See [`ENV_VARS.md`](docs/ENV_VARS.md) for a complete list of required environment variables and setup instructions.
- **Critical:** Always set `SHARE_BASE_URL` to your production domain in the Convex dashboard. The code has a fallback to `https://eveokee.com`, but this should never be used in production as it will generate incorrect share links.

### Key Environment Variables
- `SHARE_BASE_URL` — Base URL for shareable music links (required)
- `CLERK_WEBHOOK_SIGNING_SECRET` — Clerk webhook signature validation
- `CLERK_FRONTEND_API_URL` — Clerk authentication domain
- `OPENAI_API_KEY` — OpenAI API access for music prompts
- `SUNO_API_KEY` — Suno API access for music generation
- `SUNO_CALLBACK_URL` — Webhook endpoint for Suno callbacks

See [`ENV_VARS.md`](docs/ENV_VARS.md) for complete details.

## Additional Documentation
- **[`USE_CASE_DIAGRAM.md`](docs/USE_CASE_DIAGRAM.md)** — Use case paths, root functions, and dependency graphs (start here to understand the codebase structure)
- [`ENV_VARS.md`](docs/ENV_VARS.md) — Complete environment variable reference
- [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Deployment instructions
- [`LOGGING.md`](docs/LOGGING.md) — Logging guidelines
- [`SHARE_BASE_URL_SETUP.md`](docs/SHARE_BASE_URL_SETUP.md) — Share link configuration
- [`SHARING_IMPROVEMENTS.md`](docs/SHARING_IMPROVEMENTS.md) — Sharing feature documentation
- [`VAPI_SETUP.md`](docs/VAPI_SETUP.md) — VAPI integration setup
