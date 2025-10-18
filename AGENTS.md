# AGENTS.md

## Workspace Basics
- Node 20+ and pnpm 8+ are required; install dependencies with `pnpm install`.
- Prefer `pnpm` (with `--filter` when targeting a package) over `npm` or `yarn`.
- Respect existing linting, formatting, and file organization; match local conventions instead of reformatting entire files.
- Add new automated tests beside the code under a `__tests__` folder and reuse the package’s configured runner (Vitest for backend/web, Jest for mobile).
- Document any new top-level scripts or tooling you add, and note every test command you execute (and whether it passed) in your final response.

## Core Scripts (root `package.json`)
- `pnpm dev` launches Convex, web, and mobile dev servers together via Turbo/concurrently.
- `pnpm dev:convex`, `pnpm dev:web`, `pnpm dev:mobile` start each target individually (mobile uses Expo dev client).
- `pnpm build`, `pnpm build:web`, `pnpm build:mobile` run Turbo builds; mobile production binaries are produced with EAS.
- `pnpm lint`, `pnpm type-check`, `pnpm test` fan out through Turbo; scoped variants (`pnpm test:web`, etc.) exist for faster feedback.
- `pnpm clean` removes cached build artifacts and root `node_modules`; avoid unless you truly need a clean slate.

## Repository Layout
- `apps/web` — Vite React web client.
- `apps/mobile` — Expo React Native client.
- `packages/backend` — Shared Convex backend package (exports generated API).
- Shared assets and scripts live at the workspace root; expect Turbo to coordinate builds across packages.

## Convex Backend (`packages/backend`)
- Dev server: `pnpm dev:convex` (or `pnpm --filter @backend/convex dev`).
- Tests: `pnpm test:backend` (Vitest). Use the shared `createMockCtx` helper to keep unit tests deterministic and mock external services (OpenAI, Clerk, Svix).
- Convex deploy: `pnpm --filter @backend/convex deploy` (wraps `npx convex deploy`).
- Generated types/API live under `packages/backend/convex/_generated`; avoid hand editing.
- Keep functions pure and side-effect free; push any integration logic into Convex actions and mock remote calls in tests.

## Web App (`apps/web`)
- Dev server: `pnpm dev:web` (Turbo runs `pnpm --filter web dev` → `vite`).
- Build: `pnpm build:web` produces the production bundle (`vite build` after `tsc -b`).
- Tests: `pnpm test:web` (Vitest + Testing Library). Query DOM via Testing Library helpers instead of implementation details; place shared utilities in `apps/web/src/test/`.
- Type check: `pnpm --filter web type-check`. Lint: `pnpm --filter web lint`.
- The app consumes Convex via `@backend/convex`; ensure any backend schema changes preserve web usage.

## Mobile App (`apps/mobile`)
- Dev server: `pnpm dev:mobile` (Turbo → `expo start`). Use `pnpm dev:mobile:interactive` for Expo Dev Client flows.
- Platform runs: `pnpm run:ios`, `pnpm run:android`; EAS builds via root scripts (`pnpm build:ios`, `pnpm build:android`, etc.).
- Tests: `pnpm test:mobile` (Jest + Testing Library). Respect `jest.setup.ts` mocks and wrap async UI interactions with `await act(...)`.
- Lint: `pnpm --filter mobile lint`. Type check: `pnpm --filter mobile type-check`.
- Populate `.env` files from the provided examples before running Expo locally; regenerate Expo previews with the appropriate profile when native config changes.

## Shared Engineering Practices
- Keep changes isolated: update only affected packages and their tests.
- Mock network or third-party services in tests; never rely on live APIs.
- Prefer Turbo filters (`pnpm --filter`) when targeting a specific package to avoid unnecessary work.
- When introducing new scripts, update both this file and `README.md` so human teammates and agents stay in sync.
- Before final handoff, mention any commands that still need to be run (e.g., deploys, native builds) and whether you verified them locally.
