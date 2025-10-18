# AGENTS.md

## Quick Start
- Install workspace dependencies from the repo root with `pnpm install`; avoid `npm install` noted in older docs.
- Run `pnpm dev:web` (Turbo → `pnpm --filter web dev`) to start Vite at http://localhost:5173.
- Preview production locally with `pnpm --filter web preview` after running the build.
- Environment variables live in `.env.local`; copy from `.env.example` before local work.

## Scripts
- `pnpm --filter web dev` — Vite dev server with React refresh.
- `pnpm --filter web build` — Type checks via `tsc -b` then runs `vite build`.
- `pnpm --filter web preview` — Serves the production bundle.
- `pnpm --filter web lint` — ESLint (respect the existing config and autofix sparingly).
- `pnpm --filter web type-check` — Project references build without emit.
- `pnpm test:web` or `pnpm --filter web test` — Vitest run; use `test:watch` for interactive loops.

## Testing Guidance
- Use Vitest + Testing Library; prefer queries like `getByRole`/`findByText`.
- Place new tests in `apps/web/src/**/__tests__` alongside the component or module.
- Shared helpers belong in `apps/web/src/test/`; import from there instead of duplicating mocks.
- Mock Convex calls, Clerk, and Sentry integrations to keep suites deterministic.

## Implementation Notes
- The app consumes Convex via `@backend/convex`; update generated types before shipping API changes.
- Sentry configuration (traces/replays) lives in `src/main.tsx`; adjust sampling carefully and document any changes.
- Tailwind + `tailwind-merge` handle styling; follow existing utility class conventions instead of introducing CSS modules.
- Markdown rendering (`react-markdown`, `remark-gfm`, `rehype-highlight`) powers diary previews—sanitize or escape content when adding new render paths.
- Keep route definitions in sync with `react-router-dom` layout files under `src/routes`.

## Deployment
- Vercel deploys from `apps/web`; ensure `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, `VITE_SENTRY_DSN`, and PostHog vars are configured.
- Run `pnpm --filter web build` locally if you tweak build tooling; update `README.md` / root docs when adding new scripts or environment keys.
