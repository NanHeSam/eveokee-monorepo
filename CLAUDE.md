# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eveokee is a monorepo containing a mobile app (React Native/Expo), web app (Vite/React), and shared Convex backend. The app allows users to create diary entries and generates personalized music based on their entries using AI.

## Prerequisites

- Node.js 20+
- pnpm 8+ (package manager)
- Expo CLI (for mobile development)
- EAS CLI (for mobile builds)

## Common Commands

### Development

```bash
# Start all services (convex, web, mobile) concurrently
pnpm dev

# Start individual services
pnpm dev:web        # Web app on Vite dev server
pnpm dev:mobile     # Mobile app with Expo
pnpm dev:convex     # Convex backend (also: pnpm dev:backend)

# Run mobile on devices
pnpm run:ios        # Run on iOS simulator/device
pnpm run:android    # Run on Android emulator/device
```

### Building

```bash
pnpm build          # Build all apps (uses Turbo)
pnpm build:web      # Build web app only
pnpm build:mobile   # Mobile builds via EAS (not local)

# Mobile EAS builds
pnpm build:ios      # Production iOS build
pnpm build:ios:dev  # Development iOS build
pnpm build:android  # Production Android build
```

### Quality Checks

```bash
pnpm lint           # Lint all packages
pnpm type-check     # Type check all packages
pnpm clean          # Clean build artifacts and node_modules
```

### Dependency Management

```bash
# Add to root workspace
pnpm add -w <package>

# Add to specific app
pnpm add --filter mobile <package>
pnpm add --filter web <package>
pnpm add --filter @backend/convex <package>
```

## Architecture

### Monorepo Structure

- **apps/mobile/** - React Native mobile app (Expo SDK 54, React Native 0.81.4)
  - Uses NativeWind for styling (Tailwind for React Native)
  - React Navigation for routing
  - Clerk for authentication (@clerk/clerk-expo)
  - react-native-track-player for audio playback

- **apps/web/** - Vite web app (React 19, Vite 6)
  - React Router v7 for routing
  - Tailwind CSS for styling
  - Clerk for authentication (@clerk/clerk-react)
  - Sentry for error tracking
  - PostHog for analytics

- **packages/backend/convex/** - Shared Convex backend
  - Real-time database and serverless functions
  - Shared between mobile and web via `@backend/convex` workspace package
  - Clerk authentication integration
  - OpenAI integration for music generation

### Convex Backend

The Convex backend is located at `packages/backend/convex/`. It's configured in the root `convex.json` to point to this location.

**Key files:**
- `schema.ts` - Database schema with tables: users, subscriptionStatuses, diaries, music, emailNotify
- `auth.config.ts` - Clerk authentication configuration
- `diaries.ts` - Diary CRUD operations
- `music.ts` - Music generation and management
- `musicActions.ts` - Music-related actions
- `billing.ts` - Subscription and billing logic
- `usage.ts` - Usage tracking and limits
- `http.ts` - HTTP endpoints (webhooks)

**Importing from apps:**
```typescript
import { api } from '@backend/convex';
```

The package (`@backend/convex`) exports the generated API from `convex/_generated/api.js`.

**Important:** Both mobile and web apps must use `@backend/convex` for imports. After `pnpm install`, the workspace package is symlinked in `node_modules/@backend/convex`.

**Deploy** (run from repo root or `packages/backend`):
```bash
npx convex deploy
```

### Database Schema

Core tables:
- **users** - User profiles linked to Clerk, with subscription references
- **subscriptionStatuses** - Subscription tiers, usage limits, platform (Apple/Google/Clerk)
- **diaries** - Diary entries with content, date, and primary music reference
- **music** - Generated music tracks with lyrics, audio URLs, status (pending/ready/failed)
- **emailNotify** - Email notification subscriptions

Key relationships:
- Users have one active subscription (activeSubscriptionId)
- Diaries belong to users and can have a primary music track
- Music tracks belong to users and optionally link to a diary

### Turbo Configuration

Turbo is used for build orchestration. Key pipeline tasks:
- `build` - Depends on `^build` (dependencies built first)
- `lint` - Depends on `^build`
- `type-check` - Depends on `^build`
- `dev` - Not cached, runs persistently
- `clean` - Not cached

### Environment Variables

**Web app** (`apps/web/.env.local`):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- `VITE_SENTRY_DSN`
- `VITE_PUBLIC_POSTHOG_KEY`
- `VITE_PUBLIC_POSTHOG_HOST`

**Mobile app** (`apps/mobile/.env`):
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`

**GitHub Secrets** (for CI/CD):
- `CONVEX_DEPLOY_KEY`
- `EXPO_TOKEN`

## Mobile App Specifics

- Uses Expo with custom development client (expo-dev-client)
- New Architecture enabled (`newArchEnabled: true`)
- Audio background playback enabled for iOS
- Custom Expo plugin: `./plugins/with-folly-no-coroutines`
- Bundle identifiers: `com.eveokee.app`
- Custom URL scheme: `eveokee://`

## Web App Specifics

- Vite with React plugin and tsconfig paths support
- `react-dev-locator` plugin enabled for development
- Sourcemaps hidden in production builds
- Markdown files included as assets
- PostHog and Sentry externalized from SSR bundle

## Git Workflow

- Main branch: `main`
- Current branch: `project-setup/all-3p-run`
- Prefer rebase over merge for clean history (per user preferences)

## Mobile App Audio Playback

The mobile app uses `react-native-track-player` v5.0.0-alpha0 for audio playback with the following key features:

- **PlaybackService** (`apps/mobile/trackPlayerService.ts`): Handles remote playback controls (play/pause/next/previous)
- **Track activation**: Automatically activates the first track when queue is fresh (no active track)
- **Queue management**: Clears queue on app reopen to prevent stale state
- **Known fixes**:
  - Fixed infinite loop in useEffect by proper dependency management
  - Added delay to reduce race conditions during track loading
  - Refactored track activation logic for fresh queues

## CI/CD

GitHub Actions with smart change detection:
- Only affected apps are built/deployed
- Web changes don't trigger mobile builds
- Backend changes trigger validation for both apps
- Mobile builds via EAS
- Convex automatic deployment on backend changes

### Current Mobile Build Configuration

**iOS only** - Android builds are currently disabled in CI/CD.

**Preview builds** (PRs): iOS simulator builds
**Production builds** (main branch): iOS production builds

### Re-enabling Android Builds

To add Android builds back to CI/CD:

1. **Generate Android credentials** (one-time setup):
   ```bash
   cd apps/mobile
   eas credentials
   ```
   Follow prompts to generate and upload Android keystore to EAS.

2. **Update eas.json** ([apps/mobile/eas.json](apps/mobile/eas.json)):
   ```json
   {
     "build": {
       "preview": {
         "distribution": "internal",
         "android": {
           "buildType": "apk"
         },
         "ios": {
           "simulator": true
         }
       }
     }
   }
   ```

3. **Uncomment Android build in CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)):
   - Preview builds (line ~105): Add Android build step
   - Production builds (line ~126-128): Uncomment the Android build step

4. **Test locally** before pushing:
   ```bash
   cd apps/mobile
   eas build --platform android --profile preview --non-interactive --no-wait
   ```

## Troubleshooting

### Type Check Issues

If `pnpm type-check` fails with module not found errors:

1. **Missing workspace symlinks**: Run `pnpm install` to create `node_modules/@backend/convex` symlinks
2. **Wrong import paths**: All imports must use `@backend/convex` (the workspace package name)
3. **Cache issues**: Clear Turbo cache with `pnpm clean` and reinstall

### Import Best Practices

```typescript
// ✅ Correct - import from workspace package
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
```
