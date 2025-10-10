# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Diary Vibes is a monorepo containing a mobile app (React Native/Expo), web app (Vite/React), and shared Convex backend. The app allows users to create diary entries and generates personalized music based on their entries using AI.

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
pnpm add --filter convex-backend <package>
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
  - Shared between mobile and web via `convex-backend` workspace package
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
import { api } from 'convex-backend';
```

The package exports the generated API from `convex/_generated/api.js`.

**Deploy:**
```bash
cd packages/backend
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
- Bundle identifiers: `com.eveoky.diaryvibes`
- Custom URL scheme: `diaryvibes://`

## Web App Specifics

- Vite with React plugin and tsconfig paths support
- `react-dev-locator` plugin enabled for development
- Sourcemaps hidden in production builds
- Markdown files included as assets
- PostHog and Sentry externalized from SSR bundle

## Git Workflow

- Main branch: `devin/1759989405-monorepo-initial-setup`
- Current branch: `project-setup/all-3p-run`
- Prefer rebase over merge for clean history (per user preferences)

## CI/CD

GitHub Actions with smart change detection:
- Only affected apps are built/deployed
- Web changes don't trigger mobile builds
- Backend changes trigger validation for both apps
- Mobile builds via EAS
- Convex automatic deployment on backend changes
