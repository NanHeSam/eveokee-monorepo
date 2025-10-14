# AGENTS.md

## General Guidance
- Use `pnpm` for installing or running workspace scripts.
- When editing code, match the surrounding file's linting style (e.g., quote style, semicolons) instead of enforcing a new format.
- Prefer placing new automated tests alongside the code under a `__tests__` folder and use the package's existing test runner (Vitest for backend/web, Jest for mobile).
- Always update or add documentation when you introduce new top-level scripts or developer tooling.
- Record any test commands you run in the final summary, noting if they failed due to environment constraints.

## Backend (`packages/backend`)
- Use the shared `createMockCtx` helper for Convex unit tests whenever possible.
- Keep tests deterministic by mocking external services (OpenAI, Clerk, Svix) rather than hitting real APIs.

## Web App (`apps/web`)
- Use Testing Library helpers for component tests and avoid querying DOM nodes by implementation details.
- Place shared test utilities under `apps/web/src/test/`.

## Mobile App (`apps/mobile`)
- Write React Native tests with Jest + Testing Library and rely on `jest.setup.ts` for common mocks.
- Prefer async `act`-wrapped interactions for components that trigger native module promises.
