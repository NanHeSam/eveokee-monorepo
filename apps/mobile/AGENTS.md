# AGENTS.md

## Quick Start
- Run `pnpm install` at the repo root; avoid the stale `npm install` instructions.
- Start Metro with `pnpm dev:mobile` (Turbo → `pnpm --filter mobile dev` / `expo start`).
- Use `pnpm dev:mobile:interactive` for Expo Dev Client workflows that need QR prompts.
- Copy `.env.example` to `.env` and fill in Expo public keys (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CONVEX_URL`) before launching.

## Scripts
- `pnpm --filter mobile dev` — Expo start; pass `--clear` to reset caches if bundler behaves oddly.
- `pnpm run:ios` / `pnpm run:android` — Rebuilds native shells via `expo run:*`; required after native dependency changes.
- `pnpm build:ios` / `pnpm build:android` — Kicks off EAS cloud builds (ensure `eas.json` profiles and secrets are configured).
- `pnpm --filter mobile lint` — Expo ESLint config.
- `pnpm --filter mobile type-check` — TypeScript `--noEmit`.
- `pnpm test:mobile` or `pnpm --filter mobile test` — Jest + Testing Library suite; `test:watch` available for TDD loops.

## Testing Guidance
- Use React Native Testing Library helpers and `jest.setup.ts` mocks; never import from `react-test-renderer`.
- Place tests alongside components under `__tests__` folders (e.g., `app/features/foo/__tests__/Foo.test.tsx`).
- Wrap async interactions with `await act(async () => ...)` when they trigger native promises (Clerk, SecureStore, Track Player).
- Mock network/audio dependencies (`react-native-track-player`, Convex, Clerk) to keep tests deterministic.
- Track Player service lives in `trackPlayerService.ts`; update the service and tests together.

## Implementation Notes
- Navigation is configured with React Navigation in `app/`—keep screen registration in step with the typed param lists.
- Styling relies on `nativewind` and `global.css`; follow existing utility patterns instead of introducing inline styles.
- Expo modules (SecureStore, WebBrowser, AuthSession) require the custom dev client; rebuild after editing `app.json`, `plugins/`, or native modules.
- Audio playback flows depend on background services; remember to update both platform manifests (`android/`, `ios/`) when adding capabilities.
- Keep Clerk/Convex hooks in sync with backend schema changes; regenerate Convex types when needed.

## Deployment
- Use EAS build profiles from `eas.json`; update `docs/` if you add new profiles or environment secrets.
- Submit builds after validating on devices; record the Expo update or build ID when handing off.
