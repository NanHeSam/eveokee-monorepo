# AGENTS.md

## Quick Start
- Install dependencies at the repo root with `pnpm install`.
- Start the Convex dev server via `pnpm dev:convex` (root) or `pnpm --filter @diary-vibes/backend dev`; it watches `convex/`.
- Deploy with `pnpm --filter @diary-vibes/backend deploy` once changes are validated.
- Regenerate types automatically by running the dev server; avoid editing files under `convex/_generated/`.

## Scripts
- `pnpm --filter @diary-vibes/backend dev` — Runs `npx convex dev` locally.
- `pnpm --filter @diary-vibes/backend deploy` — Publishes functions to the configured Convex project (requires `CONVEX_DEPLOY_KEY`).
- `pnpm test:backend` or `pnpm --filter @diary-vibes/backend test` — Vitest suite.
- `pnpm --filter @diary-vibes/backend test:watch` — Interactive Vitest mode.
- Type checking defers to Convex runtime types; no dedicated `tsc` step is provided.

## Testing Guidance
- Use the shared `createMockCtx` helper from `__tests__/testUtils.ts` to stub mutation/query contexts.
- Keep tests under `__tests__/` at the package root (not inside `convex/` to avoid deployment); follow the naming convention `<module>.test.ts`.
- Mock third-party APIs (OpenAI, Clerk, Svix) and timers—do not hit external services during tests.
- When covering actions with side effects (`emailNotify`, `musicActions`), assert on mocked clients rather than Convex logs.

## Implementation Notes
- Schema lives in `convex/schema.ts`; run `convex dev` after schema changes to refresh generated API bindings.
- Exported endpoints (queries/mutations/actions/http endpoints) reside directly under `convex/` (e.g., `diaries.ts`, `music.ts`). Keep handlers pure and surface IO through injected clients passed via context.
- Shared constants/utilities are in `convex/constant.ts` and related modules; prefer reusing them over duplicating literals.
- `convex/index.ts` wires modules together. When adding new functions, register them there and update any consumers (`apps/web`, `apps/mobile`) after regenerating types.
- HTTP endpoints (`http.ts`) should validate payloads defensively; mirror changes in clients and tests.

## Environment & Secrets
- Local dev uses `.env.local` picked up by Convex CLI; ensure required secrets (Clerk, OpenAI, Suno, SHARE_BASE_URL) are available before calling dependent functions.
- Production deploys require the `CONVEX_DEPLOY_KEY`; coordinate with ops before rotating keys or adding new secrets.
- See [`ENV_VARS.md`](docs/ENV_VARS.md) for a complete list of required environment variables and setup instructions.
- **Critical:** Always set `SHARE_BASE_URL` to your production domain in the Convex dashboard. The code has a fallback to `https://diaryvibes.com`, but this should never be used in production as it will generate incorrect share links.
