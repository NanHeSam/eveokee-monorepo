# Development readiness audit — September 9, 2026

> This document records the initial audit. The subsequent authorized production repair, live generation checks, and updated service findings are documented in [the music incident report](music-generation-incident.md).

The repository can run locally: all 413 automated tests pass, the web app builds and renders, and the iOS development app builds and reaches its login screen on an iPhone 17 Pro simulator. It needs dependency maintenance, a Kie account unlock, and a working StoreKit test setup before broader feature development and release testing.

This is a dependency, configuration, access, and development-readiness audit with targeted source review, not an exhaustive penetration test or authenticated end-to-end certification. No dependency upgrades, production deployments, paid generation jobs, calls, purchases, webhook replays, or support messages were initiated. Normal app startup did contact its configured SDK services and created an anonymous RevenueCat customer.

## Scope and preserved work

- Checkout: `0bc9b2f`, last commit December 22, 2025.
- Existing user edits were preserved in `apps/mobile/app.config.ts` and `packages/backend/convex/memory/util.ts`.
- Four workspace packages: root tooling, Expo mobile, Vite web, and Convex backend. `apps/admin` only has leftover local configuration; it is not a runnable workspace package.
- Package manifests and lockfile were unchanged. A frozen offline install with lifecycle scripts disabled succeeded; this validates this machine's cached dependency installation, not a clean online/native setup.
- New repository files are this audit and its two inventories. Build outputs and detailed command logs are local/ignored or in `/tmp/eveokee-audit-20260909`.
- [All direct dependency declarations and installed versions](dependencies.md).
- [Full registry vulnerability snapshot](security-advisories.md).

## Service access

“API works” below means the named read-only endpoint responded successfully. It does not establish generation billing, account-wide administration, webhook delivery, or every feature's permissions.

| Service | Role | Verified access | Remaining limitation/action |
|---|---|---|---|
| GitHub | Source and CI | `gh` authenticated; ADMIN access to repository; recent CI runs and secret names readable | Existing CI does not run tests; see findings below |
| Expo / EAS | Mobile builds, development client | Initially logged out; user logged in; CLI confirms owner access to `eveokee`, project `@eveokee/eveokee-mobile`, and build history | CLI is old (16.20.0); latest observed successful production build is 1.3.0 from December 11, 2025; no new cloud build submitted |
| Convex | Database, storage, functions, cron, HTTP webhooks | Local CLI 1.31.0 can read development and production environment configuration | Deploy not attempted; keys live in cloud environment, not backend `.env.local`; root/client Convex installs are 1.28.0 while backend is 1.31.0 |
| Kie.ai | Sora video generation | Portal login works; configured dev/prod key prefixes match portal entries | Both keys return HTTP 200 with application code 500 and an account-locked message; provider intervention needed |
| Suno API (`api.sunoapi.org`) | Music and timestamped lyrics | Credit endpoint accepts the configured key | Separate endpoint/key from Kie video; generation/callback round-trip not exercised |
| OpenAI | Diary, lyrics, video-script and blog text processing | Authenticated model listing works; configured `gpt-4o-mini`, `gpt-5-mini`, and `gpt-4.1-2025-04-14` are accessible via metadata endpoints | Inference/billing not exercised; backend key shared across dev/prod |
| Vercel AI Gateway | Memory extraction and relationship highlights | Development and production credit endpoints succeed | Current extraction `openai/gpt-5.4-nano` and highlight `openai/gpt-4o-mini` appear in catalog; unused wrapper default `openai/gpt-5.1-instant` does not |
| Clerk | Authentication and identity webhooks | Public JWKS endpoint works; clients share the same development publishable key; mobile login UI renders | No Clerk secret management key configured locally/in Convex; admin API and actual sign-in not tested |
| RevenueCat | Subscription state and paywalls | iOS SDK reads offerings/product mapping successfully; dev/prod backend customer-read requests return expected missing-customer response for a nonexistent audit ID | Backend keys lack `project_configuration:projects:read` and `project_configuration:apps:read`; simulator cannot resolve StoreKit products; Android public key missing |
| Vapi | Scheduled phone diaries | Authenticated GET of configured phone-number resource succeeds | Credential ID is configured but provider credential health/call execution not tested; phone resource is Vapi-managed |
| Sentry | Errors, replay, releases | Mobile token valid with `org:ci`; releases endpoint succeeds | Project-read request gets 403; dashboard/error inspection requires broader read access; local web DSN empty |
| PostHog | Analytics and replay | Public project keys and hosts configured; mobile SDK initializes | Cloud key is a project token; management API returns 401 because it requires a personal API key; event ingestion and analytics query access not certified |
| Vercel hosting | Web deployment | CLI authenticated; Eveokee project visible; `www.eveokee.com` deployment reports Ready, created December 22, 2025 | New deployment not attempted |
| Slack | Blog draft notifications/review callbacks | Incoming webhook configured in dev/prod | Delivery not tested because that would send a message; no Slack management token verified |
| Expo Push | Mobile notifications | Push implementation present using Expo push endpoint | No device push token/delivery test; requires a physical-device workflow |
| Apple / App Store Connect | Native toolchain, signing, purchases, Apple sign-in | Xcode and simulators usable; valid Apple Development identity present; signed simulator build succeeds | App Store Connect session/roles, distribution signing, Apple sign-in and purchase flows not verified |
| Google Play / Android | Android app distribution and Google sign-in via Clerk | JDK 17, adb, SDK platforms 35/36 and build tools installed | Android build/device/store access not exercised; RevenueCat Android key absent |

Google AI packages (`@google/generative-ai`, `@ai-sdk/google`) and `@ai-sdk/openai` are installed in backend but no direct imports were found in current application source. They do not establish an active separate Google API dependency. Mobile `openai` and `svix` similarly have no direct imports in mobile source; audit these declarations for removal. No separate direct Stripe, Twilio, email-delivery or external storage client was found in active source; some names appear as provider/platform types.

For full administrative access, the remaining needs are Clerk administration credentials/session, a PostHog personal API key, RevenueCat project-configuration read access, Sentry project/event read access, and App Store Connect access for release/purchase inspection. These are separate from ordinary runtime API keys. No additional Expo, Convex, GitHub, or Vercel login is currently needed.

## Kie portal investigation

The logged-in portal contains the same `dev key` and `prod key` used by Convex. Their visible masked prefixes were compared locally without exposing full keys. Both have All Models access and no configured IP list visible. The production key edit dialog also confirms All Models. The billing page shows a positive credit balance (9,756 on the last refreshed view), so the portal does not indicate exhausted credits.

The documented `GET https://api.kie.ai/api/v1/chat/credit` endpoint returns HTTP 200 but body `code: 500` and an account-locked message for both keys. Settings and billing show no explanation or self-service unlock control. The log page has no recent logs and says logs are retained for two months. Old generation history cannot explain the restriction from this view.

The account has an active private Discord VIP support channel accessible from Settings. Ask Kie support why the account is locked and whether they require key rotation after unlocking it. A new key was not created: current evidence points to an account-level restriction rather than a missing, mismatched, or model-restricted key. Exact cause remains unconfirmed by the provider.

Suggested support text, not sent:

> I can log into the Kie portal and see a positive credit balance. Both existing development and production API keys return an account-locked error from GET /api/v1/chat/credit (HTTP 200, body code 500). Their portal settings permit all models. Please identify the reason for the restriction, restore API access if appropriate, and confirm whether any key rotation is required.

Reference: [Kie credit API](https://docs.kie.ai/common-api/get-account-credits).

## Prioritized findings

### 1. Harden generation callbacks before exposing more traffic

`packages/backend/convex/webhooks/handlers/kie.ts` and `suno.ts` validate method and payload shape but do not authenticate the sender. Kie's handler fetches a callback-supplied URL, buffers it, and stores the blob before the final task-completion mutation. This allows unauthenticated requests to trigger outbound fetch/storage work and potentially spoof results for known task IDs. No exploitation was attempted.

Add provider signature verification, verify the pending task before downloading, and bound URL destinations, redirects, content type, response size and timeout. Kie's portal now explicitly offers a Webhook HMAC Key in Settings; no such key is currently configured there. Suno also needs authenticated callbacks or provider-side result verification before trusting completion payloads.

### 2. Align Expo dependencies, then plan the SDK upgrade

Current mobile baseline: Expo 54.0.13, React Native 0.81.4, React 19.1.0, New Architecture enabled. Expo Doctor passes 13 of 18 checks. Five failures:

1. 23 package compatibility mismatches; image-picker 16.0.6 should be ~17.0.11 and media-library 17.0.6 should be ~18.2.1 for this SDK. SDK 54 patch recommendation is ~54.0.37; React Native recommendation is 0.81.5.
2. Missing direct `expo-font` peer for vector icons.
3. Duplicate `react-native-safe-area-context` 5.6.1 and 4.5.0 (through calendars).
4. Direct `@expo/config-plugins` installation warning; inspect local plugin imports before removal.
5. React Native Directory flags Track Player as unsupported on New Architecture. Installed version is a 5.0.0 alpha; a successful build/login is not proof of playback/background reliability.

`pnpm outdated` reports 102 unique outdated package names. Registry latest versions are recorded in the inventory, not proposed as a bulk upgrade. Deprecated direct packages include `@clerk/clerk-expo` (replacement `@clerk/expo`), `@clerk/clerk-react` (replacement `@clerk/react`), and `@testing-library/jest-native` (matchers built into React Native Testing Library).

First make SDK 54 coherent and reproduce the mobile workflows; then upgrade Expo one SDK at a time, following [Expo's upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/). React, React Native, Reanimated, worklets and Expo modules must move together. Coordinate Clerk migration across mobile, web and backend. Avoid forcing every dependency to its registry latest version.

### 3. Address registry vulnerabilities with reachability context

| Dependency scope | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|
| All dependencies | 6 | 105 | 59 | 10 |
| Production dependency graph | 3 | 90 | 44 | 6 |

These are registry-reported counts, not confirmed vulnerabilities in deployed app paths. The production graph includes Expo CLI tooling. The full audit contains 166 advisory records; production contains 137.

- Clerk shared-package route-matcher bypass: affected shared package installed, but no `createRouteMatcher`/`createPathMatcher` application usage or Next/Nuxt/Astro middleware found. Convex token verification is distinct. Upgrade the SDKs; do not equate the advisory with a demonstrated authentication bypass here. [Clerk advisory](https://github.com/advisories/GHSA-vqx2-fgx2-5wq9).
- React Server Components RCE: affected `react-server-dom-webpack` enters through `jest-expo`; no RSC server endpoint found in the app. [React advisory](https://github.com/advisories/GHSA-fv66-9v8q-g76r).
- Vitest 2.1.9: critical issue concerns an exposed Vitest UI/API server; current scripts use `vitest run`. Upgrade the test stack. [Vitest advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp).
- Other critical families include `tar` and `shell-quote`; numerous high findings affect Vite, React Router, Rollup and transitive build/parser packages. Use the full advisory inventory to choose releases that cover all currently reported advisories, not only the first patch mentioned by an old advisory.

### 4. Restore reliable mobile feature testing

Both unsigned and signed Debug simulator builds succeeded using the existing local Pods/native project. Metro bundles 3,104 modules and the app reaches its email/password, Google and Apple login screen. The unsigned run produced SecureStore entitlement warnings; they disappeared after the signed simulator rebuild. That warning was a test-artifact signing issue, not demonstrated as a source defect.

Outstanding runtime findings:

- RevenueCat successfully fetches API offerings, but StoreKit returns none of `eveokee_premium_monthly`, `eveokee_premium_weekly`, or `eveokee_premium_annual`. No local `.storekit` configuration was found. Set up StoreKit test data for the dev bundle or validate sandbox products on a properly provisioned physical device before concluding production billing is broken. See [RevenueCat's Apple testing guide](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store); local StoreKit configuration testing should be launched through Xcode.
- FullPlayer calls Track Player options before setup and emits a “player is not initialized” warning. Test initialization order, audio/video transitions, interruptions and background playback.
- Mobile local configuration has no Android RevenueCat key.
- Sentry initializes when a DSN exists even in development, despite a comment claiming otherwise. PostHog replay is also enabled. Make environment behavior explicit; the current startup logs confirm development telemetry initialization.
- Native directories and Pods are ignored/untracked. This successful build reused them; it does not verify clean prebuild/plugin regeneration. Several custom native plugins need validation in a clean reproducible build.
- Root `run:ios`, `run:android`, and `dev:mobile:interactive` omit `APP_VARIANT=development`; package `ios`/`android`/`dev` scripts supply it. Prefer the package scripts to avoid selecting the wrong bundle variant during regeneration.

Physical-device Apple login, push notifications, real/sandbox purchases, background audio, camera/library permissions, Android runtime, and authenticated diary/music/video flows remain untested.

### 5. Repair validation and deployment gaps

- Backend `type-check` script merely echoes a skip message. Direct `tsc -p tsconfig.json` fails because `node` and `vite/client` type definitions are not resolvable from the backend package. Passing root type-check does not certify the backend.
- Web normal build and SSR type-check pass. `build:prerender` initially fails because its Node script does not load `.env.local`; passing the already configured `VITE_CONVEX_URL` explicitly makes the complete build/prerender/sitemap/RSS sequence pass. Vercel configuration invokes this longer build.
- CI does not execute `pnpm test`. Add tests to the release gate.
- Path filters omit root lockfile/package changes and backend package tooling/tests, so relevant changes may not trigger package build/deploy jobs.
- Convex CI deploy command runs from repository root rather than `packages/backend`; make the working directory explicit and validate deployment targeting.
- Mobile CI jobs are hard-disabled with `if: false`; comments mention manual dispatch, but no `workflow_dispatch` trigger exists.
- Mobile `build` script only prints a message; a passing Turbo mobile build is not native-build verification.
- Web bundle has a 1.62 MB JS chunk (about 407 KB gzip). Split route/feature code as appropriate. Browser compatibility databases are stale.

### 6. Configuration and source hygiene

- Production `SHARE_BASE_URL` is configured; development lacks it and falls back inconsistently to the production domain or localhost depending on feature.
- Backend local `.env.local` includes `CLERK_JWT_ISSUER_DOMAIN`, while deployed auth configuration reads `CLERK_FRONTEND_API_URL`. The correct cloud variable exists, but local setup guidance should use consistent names.
- Development and production share some paid service keys (OpenAI, Suno and Vapi); a development integration test can consume the same provider account.
- AI Gateway's default `openai/gpt-5.1-instant` is absent from the live model catalog. Current callers explicitly use available models, so this is a latent default issue rather than a confirmed active failure.
- Targeted tracked-file pattern scanning found no OpenAI/Clerk/AWS/private-key/Slack webhook secret candidates. Only `.env.example` files are tracked. This was not a full history/entropy secret scan.
- Blog review source logs preview tokens, and memory code logs prompts/person highlights; review sensitive content retention and logging before expanding production use.

## Local tools and validation

Node 22.22.3, pnpm 8.15.0 (matches packageManager), Xcode 26.6, CocoaPods 1.16.2, iOS 26.5 simulator, Java 17 and Android SDK tools are installed. A valid Apple Development signing identity exists. No additional Apple tooling installation was necessary for the simulator smoke test.

| Command/check | Result |
|---|---|
| `pnpm test:backend` | PASS: 313 tests / 26 files |
| `pnpm test:web` | PASS: 60 tests / 6 files |
| `pnpm test:mobile --runInBand` | Invocation failed: pnpm interpreted the forwarded flag; no tests executed |
| `pnpm --filter mobile run test --runInBand` | PASS: 40 tests / 2 suites |
| `pnpm --filter web type-check` | PASS |
| `pnpm --filter mobile type-check` | PASS |
| `pnpm --filter web type-check:ssr` | PASS |
| `pnpm --filter @backend/convex exec tsc --noEmit -p convex/tsconfig.json` | Audit invocation used nonexistent path; no source check |
| `pnpm --filter @backend/convex exec tsc --noEmit -p tsconfig.json` | FAIL: missing node and vite/client types |
| `pnpm --filter web lint` | PASS: 6 warnings |
| `pnpm --filter mobile lint` | PASS: 4 warnings |
| `pnpm --filter web build` | PASS; large chunk/stale database warnings |
| `pnpm --filter web build:prerender` | FAIL without explicit process env URL |
| `VITE_CONVEX_URL=<existing local value> pnpm --filter web build:prerender` | PASS including prerender and SEO generation |
| `pnpm --filter mobile exec expo install --check` | FAIL: 23 mismatches |
| `pnpm dlx expo-doctor@latest` from apps/mobile | FAIL: 13/18 checks pass |
| `pnpm audit --json` / `pnpm audit --prod --json` | Completed; nonzero exit due to findings |
| `pnpm outdated -r --format json` | Completed; 102 outdated package names |
| `pnpm install --frozen-lockfile --ignore-scripts --offline` | PASS; manifests/lockfile unchanged |
| `xcodebuild -list -workspace apps/mobile/ios/eveokeeDev.xcworkspace` | PASS |
| Debug simulator `xcodebuild ... CODE_SIGNING_ALLOWED=NO build` | PASS; 109 seconds |
| Signed simulator build, first retry | Audit command quoting error split destination; exit 70, not a source failure |
| Debug simulator `xcodebuild ... CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build` | PASS; 44 seconds |
| simctl boot/install/launch + Metro | PASS; verified login UI; StoreKit and player warnings remain |
| `pnpm --filter web preview --host 127.0.0.1 --port 4173` + browser | PASS; landing page renders |

Native build command (prefix both runs with `APP_VARIANT=development SENTRY_DISABLE_AUTO_UPLOAD=true`):

```sh
xcodebuild \
  -workspace apps/mobile/ios/eveokeeDev.xcworkspace \
  -scheme eveokeeDev -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=DBE96545-8202-4F56-8892-11B7CFDBFB3E' \
  -derivedDataPath /tmp/eveokee-audit-20260909/DerivedData \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

## Suggested next work

1. Get Kie's provider-side account restriction explained/unlocked; verify the existing keys again before rotating them.
2. Authenticate generation callbacks and bound callback-triggered downloads/storage work.
3. Align SDK 54 packages, fix missing/duplicate native peers, migrate deprecated Clerk packages, and update vulnerable dependencies in coordinated groups.
4. Add real backend type-checking and tests to CI; make build/deployment targeting explicit.
5. Add StoreKit simulator configuration, fix player initialization order, then run authenticated and physical-device flows.
6. Validate a fresh prebuild/native build before planning the sequential Expo SDK upgrade and production release.

No deployment or store submission is needed merely to read this audit. Convex deployment, new EAS builds, native regeneration and store submissions remain unverified and should follow the relevant fixes and end-to-end validation.

At handoff, the simulator is open with the development app installed and Metro remains on localhost:8081. The temporary web preview server was stopped. For a future session, `pnpm --filter mobile dev:dev-client` starts the development client workflow; authenticated feature testing still needs an app test-account login.
