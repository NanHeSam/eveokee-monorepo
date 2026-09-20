# Modernization follow-up — September 20, 2026

Fixes verified locally before pushing `chore/dependency-modernization`.

## Changes

- React Navigation 7: events reached through Settings explicitly open the sibling
  Diary stack. Both cross-stack and local transitions reuse an existing diary
  entry with `pop: true`, while still opening an entry when none exists.
- Sign Up returns to Sign In with `popTo`, preventing repeated auth screens.
- Six integration tests press the actual screen controls using the real React
  Navigation container and routers, covering new/existing diary entries from
  both stacks and returning to Sign In with/without an existing route.
- Clerk styles use a named CSS layer below Tailwind 4 utilities. Browser checks
  cover both sign-in and sign-up: translucent cards, expected shadows, white
  OAuth buttons with borders, and purple footer links.
- Vite runs `react-dev-locator` through `@rolldown/plugin-babel` during development.
  Production excludes locator metadata and retains the previous bundle size.
- Splash configuration restores iOS full-screen cover artwork and Android's
  previous 200dp image sizing. A clean temporary prebuild verifies generated
  native configuration without modifying the workspace's native projects.
- Expo is updated to 57.0.24, build-properties to 57.0.21, constants to 57.0.19,
  image-picker to 57.0.19, and notifications to 57.0.20.

## Validation

| Command / check | Outcome |
|---|---|
| `pnpm install --frozen-lockfile` | Passed; lockfile matches manifests. |
| `pnpm verify` (lint, type-check, test) | Passed. Web: 60 tests; mobile: 46 tests. Unchanged backend reused the previous successful 328-test and type-check cache. Lint: 29 web and 58 mobile warnings, no errors. |
| `pnpm --filter mobile exec jest --runInBand app/screens/__tests__/Navigation.modernization.test.tsx` | Final pass: 6 tests. Pre-fix tests reproduced regressions; an intermediate test navigator lifecycle issue was corrected. |
| `pnpm --filter mobile type-check` | Passed after correcting two new test ref typings. |
| `pnpm --filter mobile exec eslint app/screens/EventDetailsScreen.tsx app/screens/SignUpScreen.tsx app/screens/__tests__/Navigation.modernization.test.tsx` | Passed; 8 existing warnings, no errors. |
| `pnpm --filter web build` | Passed before and after restricting locator to development; final JS bundle approximately 1.454 MB. |
| `pnpm --filter web build:ssr` | Passed. |
| `pnpm --filter web exec tsc --noEmit --moduleResolution bundler --module esnext --target es2020 --skipLibCheck vite.config.ts` | Passed. |
| Vite `createServer` / `transformRequest` Node assertions | Passed: development output includes locator file/line/column attributes. |
| Browser checks on production `/sign-in` and `/sign-up`, plus development `/sign-in` | Passed: Clerk styling restored; locator metadata present only in development. |
| `pnpm --filter mobile exec expo export --platform ios --platform android --output-dir /tmp/eveokee-fixes-native-export` | Passed for both platforms. |
| `CI=1 pnpm --filter mobile exec expo install --check` | Initially reported 5 patch mismatches; passed after updating. |
| `CI=1 pnpm --filter mobile exec expo prebuild <temporary-project> --platform all --no-install` | Passed for iOS and Android in an isolated copy of config, assets and plugins. |
| Python assertions on generated splash artifacts | Passed: iOS cover image constrained to all four edges; Android image preserves source aspect ratio at 200dp. Initial probe incorrectly assumed square artwork and was corrected for the portrait source. |
| `CI=1 pnpm dlx expo-doctor` (mobile directory) | 19/21 checks passed; remaining findings below. |
| `git diff --check` | Passed. |

An initial attempt to use `pnpm --filter mobile test --runInBand ...` was rejected
by pnpm before Jest ran; the successful focused command uses `exec jest` above.

## Remaining release verification

- CocoaPods cannot run until the local Xcode license is accepted. `pod --version`
  reports that specific prerequisite; no native compilation was claimed.
- Expo Doctor still flags `react-native-track-player` as unsupported on the New
  Architecture. The existing alpha dependency remains unchanged; background and
  lock-screen playback require testing on a rebuilt native app.
- Rebuild and device-test OAuth/session restoration, purchases/restore,
  notifications and release splash appearance before mobile release. Prebuild
  and JavaScript export do not establish those runtime behaviors.
- The Clerk upgrade requires iOS 17.0, as documented in the original modernization
  report. No deployment or EAS build was triggered by this follow-up.
- Remaining security advisories from the verification pass are separate debt;
  no broad dependency overrides were introduced for them.

The user's existing app version bump and conversation notes are excluded from
the fix commit and remain in the working tree.
