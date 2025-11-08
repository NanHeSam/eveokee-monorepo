# Eveokee Monorepo

This monorepo contains the Eveokee mobile app, web app, and shared Convex backend.

## Structure

- `apps/mobile` - React Native mobile app (Expo)
- `apps/web` - Vite web app
- `packages/backend/convex/` - Shared Convex backend

## Prerequisites

- Node.js 20+
- pnpm 8+
- Expo CLI (for mobile development)
- EAS CLI (for mobile builds)

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   - Copy `apps/web/.env.example` to `apps/web/.env.local`
   - Copy `apps/mobile/.env.example` to `apps/mobile/.env`
   - Fill in the values

3. Start development:
   ```bash
   # Web app
   pnpm dev:web
   
   # Mobile app
   pnpm dev:mobile
   ```

## Scripts

- `pnpm dev:web` - Start web app development server
- `pnpm dev:mobile` - Start mobile app development server
- `pnpm build` - Build all apps
- `pnpm build:web` - Build web app only
- `pnpm build:mobile` - Build mobile app (via EAS)
- `pnpm lint` - Lint all packages
- `pnpm type-check` - Type check all packages
- `pnpm test` - Run all package test suites via Turbo
- `pnpm test:backend` - Run backend tests only
- `pnpm test:web` - Run web tests only
- `pnpm test:mobile` - Run the Expo Jest suite only
- `pnpm clean` - Clean all build artifacts and node_modules

## Testing

Vitest is configured for both the Convex backend and the Vite web app, and
Jest powers the React Native test harness.

- Run `pnpm test` to execute every configured suite across the workspace. Turbo
  handles caching and parallelism.
- Use `pnpm test:backend` to run Convex unit tests in isolation.
- Use `pnpm test:web` to run the web app's Vitest + Testing Library suite.
- Use `pnpm test:mobile` to execute the mobile app's Jest + Testing Library
  suite.

The first run may need to install dev dependencies. If your environment blocks
scoped npm packages, mirror the dependencies into a registry you can access or
install them locally before running the tests.

## Deployment

### Web (Vercel)
- Automatic deployment on push to main
- Configure Vercel project to point to `apps/web`
- Set root directory to `apps/web` in Vercel settings

### Mobile (EAS)
- Preview builds on PRs
- Production builds on main branch pushes
- Requires `EXPO_TOKEN` GitHub secret

### Convex Backend
- Automatic deployment on backend changes via GitHub Actions
- Requires `CONVEX_DEPLOY_KEY` GitHub secret
- **Important:** Set all environment variables in the [Convex dashboard](https://dashboard.convex.dev) under Settings → Environment Variables before deploying
  - `SHARE_BASE_URL` - Your production domain (e.g., `https://yourdomain.com`) for generating share links
  - `CLERK_WEBHOOK_SIGNING_SECRET` - From Clerk dashboard
  - `CLERK_FRONTEND_API_URL` - Your Clerk domain
  - `OPENAI_API_KEY`, `SUNO_API_KEY` - For AI music generation
- See [`packages/backend/ENV_VARS.md`](packages/backend/docs/ENV_VARS.md) for detailed documentation

## Environment Variables

### Convex Backend (`packages/backend/.env.local`)

The Convex backend requires several environment variables for third-party integrations. See [`packages/backend/ENV_VARS.md`](packages/backend/docs/ENV_VARS.md) for a complete reference.

**Critical Variables:**
```bash
# Base URL for generating shareable music links
# Set this to your production domain in the Convex dashboard
SHARE_BASE_URL=https://yourdomain.com

# Authentication
CLERK_WEBHOOK_SIGNING_SECRET=
CLERK_FRONTEND_API_URL=

# AI & Music Generation
OPENAI_API_KEY=
SUNO_API_KEY=
SUNO_CALLBACK_URL=
```

**For local development:** Create `.env.local` in the repo root with the above variables. The Convex CLI will automatically load it.

**For production:** Set all variables in the [Convex dashboard](https://dashboard.convex.dev) under Settings → Environment Variables. **Do not rely on hardcoded defaults.**

### Web App (`apps/web/.env.local`)
```
VITE_CLERK_PUBLISHABLE_KEY=
VITE_CONVEX_URL=
VITE_SENTRY_DSN=
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=
```

### Mobile App (`apps/mobile/.env`)
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
```

## GitHub Secrets Required

Add these secrets to your GitHub repository settings:
- `CONVEX_DEPLOY_KEY` - Convex deployment key from dashboard
- `EXPO_TOKEN` - Expo access token from account settings

## CI/CD

The monorepo uses GitHub Actions for CI/CD with smart change detection:
- Only affected apps are built/deployed
- Web changes don't trigger mobile builds
- Backend changes trigger validation for both apps

See `.github/workflows/ci.yml` for details.

## Development

### Adding Dependencies

```bash
# Add to root
pnpm add -w <package>

# Add to specific app
pnpm add --filter mobile <package>
pnpm add --filter web <package>

# Add to backend
pnpm add --filter @backend/convex <package>
```

### Working with Convex

The Convex backend is shared between mobile and web apps. Import like:
```typescript
import { api } from '@backend/convex';
```

To deploy Convex functions:
```bash
npx convex deploy
```

## License

Private - All rights reserved
