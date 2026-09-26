# Stack modernization — September 11, 2026

Follow-up to the [September 9 audit](README.md). That audit inventoried the stack and recommended
coordinated upgrades; this pass executes them. All work is on branch `chore/dependency-modernization`
as seven focused commits, each verified before the next was started.

## Result

| Area | Before | After | Verification |
|---|---|---|---|
| Convex | 1.28 / 1.31 mixed | 1.45 everywhere | backend tests 313/313 |
| Backend SDKs | ai 5, @ai-sdk/gateway 1, @clerk/backend 2, openai 6, vapi 0.10 | ai 7, gateway 4, clerk 3, openai 7, vapi 2 | 313 tests, real `tsc` gate (new) |
| Web toolchain | Vite 6, Vitest 2, ESLint 9, TS 5.8 | Vite 8 (rolldown), Vitest 5, ESLint 10, TS 5.9 | tsc, lint, 60 tests, build, prerender+sitemap+RSS |
| Web styling | Tailwind 3.4 | Tailwind 4.3 via official upgrade tool | build + screenshots in `screens/` |
| Web auth | @clerk/clerk-react 5 (deprecated) | @clerk/react 6 | tsc/lint/tests |
| Mobile | Expo SDK 54, RN 0.81.4, React 19.1 | Expo SDK 57, RN 0.86.3, React 19.2.3 | tsc, jest 40/40, lint, expo-doctor 20/21, clean prebuild, signed simulator build boots to the login screen (`screens/ios-sdk57-signed.png`) |
| Mobile auth | @clerk/clerk-expo 2 (deprecated) | @clerk/expo 4 + config plugin | native build links ClerkKit via SPM |
| Mobile nav | React Navigation 6 | React Navigation 7 | tsc + jest |
| CI | Node 20, no tests, mobile jobs `if: false` | Node 22, lint+type-check+test gate, manual EAS dispatch | YAML validated; not yet run on GitHub |

`pnpm outdated` went from 102 outdated package names to a handful of intentional holds (below).

## Commits

1. `chore(deps): same-major bumps, align convex 1.45, drop unused packages`
   Removed packages nothing imported: backend `svix`, `@google/generative-ai`, `@ai-sdk/google`,
   `@ai-sdk/openai`; mobile `openai`, `svix`, `react-native-worklets-core`.
   lucide-react 1.x dropped brand icons; the footer X icon now comes from react-icons.
2. `chore(deps): web toolchain majors` — Vite 8 / Vitest 5 / ESLint 10 / TS 5.9, native
   `resolve.tsconfigPaths` instead of the plugin, jest-dom 7.
3. `chore(deps): backend SDK majors + web Clerk v6 migration` — Vapi SDK 2 renamed its DTO
   types; Clerk 6 replaced `SignedIn`/`SignedOut` with `<Show when=...>`. The backend
   `type-check` script was a no-op echo; it now runs `tsc` and immediately found
   `usage.recordMusicGenerationWithReconciliation` declared as a public `action` but called via
   `internal.usage.*` (fixed: it is now `internalAction`).
4. `chore(mobile): upgrade to Expo SDK 57` — details in the commit message; notable code changes:
   `StyleSheet.absoluteFillObject` removed in RN 0.86, `expo-status-bar` dropped `translucent`,
   RN Testing Library 14 made `render` async, Clerk's classic `useSignIn`/`useSignUp` moved to
   `@clerk/expo/legacy`, splash config moved to the `expo-splash-screen` plugin,
   `newArchEnabled`/`edgeToEdgeEnabled` are no longer config keys.
5. `chore(web): migrate to Tailwind CSS 4` — config now lives in `src/index.css`; 27 templates
   updated for renamed utilities; `@tailwindcss/vite` replaces PostCSS/autoprefixer.
6. `ci: run tests in the gate, Node 22, broader path filters, manual mobile builds`.
7. `docs: update stack versions and CI notes`.

## Intentional holds (not upgraded)

- `react-native-track-player` stays on `5.0.0-alpha0`. Registry `latest` is 4.1.2; React Native
  Directory flags the library as unsupported on the New Architecture. It compiled and linked on
  RN 0.86; runtime playback still needs a device test.
- `@sentry/react-native` 7.11 (Expo SDK 57 pins `~7.11.0`; 8.x exists).
- `typescript` 5.9 on web/backend; mobile is on 6.0.3 because Expo SDK 57 requires it. TS 7 (the
  Go port) is available but not adopted.
- `tailwindcss` 3.4 remains in the mobile app: NativeWind 4 requires Tailwind 3.
- `pnpm` 8.15 (`packageManager`). pnpm 12 is current; bumping changes the lockfile format and
  Vercel/CI install behaviour, so it is a separate change.
- `jest` 29 on mobile (jest-expo 57 is built for it).

## Findings from this pass

- **Latent type bug** in `packages/backend/convex/usage.ts` (see commit 3). It worked at runtime
  because Convex resolves function references by path, but the types were wrong and the old
  type-check script could not catch it.
- **React Compiler lint rules** (eslint-plugin-react-hooks 7, also shipped by eslint-config-expo 57)
  flag 20 places in web and 58 in mobile: `set-state-in-effect`, `refs`, `immutability`, `purity`,
  `preserve-manual-memoization`. They are downgraded to warnings in both ESLint configs so they stay
  visible. Fixing them is a behaviour-sensitive refactor and should be its own PR.
- **Mobile `strict: false`** interacts badly with React Navigation 7 typings: with
  `strictNullChecks` off, `id` becomes required on navigators and `beforeRemove` loses
  `preventDefault`. Worked around with explicit `id` props and an explicit listener type. Enabling
  `strictNullChecks` currently produces 51 errors (44 inside shared backend files pulled in via
  `@backend/convex`), so that is a separate project.
- **Backend test typing debt**: 24 type errors exist only in `packages/backend/__tests__`
  (loose `db.get` unions, Node `Blob` vs DOM `Blob`, stale `"alpha"` tier literal). The new
  `type-check` gate excludes `__tests__` and `*.test.ts` until they are cleaned up.
- **Dev-client keychain crash**: a simulator build with `CODE_SIGNING_ALLOWED=NO` has no keychain
  entitlement. SecureStore only warns, but ClerkKit 1.5 hits `assertionFailure` in `Clerk.configure`
  and the Debug app exits right after JS boot. Build simulator apps with
  `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-` (or `expo run:ios`); EAS builds are unaffected.
- **`@clerk/expo` 4 needs its config plugin** (`"@clerk/expo"` in `plugins`). Without it the
  `ClerkExpo` pod (iOS 17 minimum) is skipped and RN's SPM post-install hook crashes with
  `undefined method 'package_product_dependencies' for nil`.
- The iOS deployment target is now 17.0 (Clerk requirement). App Store availability drops iOS 16.

## Not done / next

1. Run the new CI on a PR and fix anything environment-specific (first run of tests in CI).
2. Device test of the SDK 57 build: Apple/Google sign-in through Clerk 4, background audio via
   Track Player, RevenueCat purchases (needs a StoreKit config; see the September 9 audit).
3. Refactor the React Compiler lint warnings (web 20, mobile 58) and re-enable them as errors.
4. Clean up the 24 backend test typing errors and drop the `__tests__` exclusion.
5. Decide on pnpm 10+ and Node 24 LTS; update `packageManager`, Vercel, and CI together.
6. Re-check `pnpm audit` after CI is green; most previously reported advisories were in the build
   toolchain that has now been replaced (Vite, Vitest, React Router, Clerk).
7. `apps/admin` is still a leftover directory with only local config; delete it or make it a package.
