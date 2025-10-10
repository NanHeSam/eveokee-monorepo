# Diary Vibes Monorepo

This monorepo contains the Diary Vibes mobile app, web app, and shared Convex backend.

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
- `pnpm clean` - Clean all build artifacts and node_modules

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
- Automatic deployment on backend changes
- Requires `CONVEX_DEPLOY_KEY` GitHub secret

## Environment Variables

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

# Add to shared backend
pnpm add --filter convex-backend <package>
```

### Working with Convex

The Convex backend is shared between mobile and web apps. Import like:
```typescript
import { api } from 'convex-backend';
```

To deploy Convex functions:
```bash
npx convex deploy
```

## License

Private - All rights reserved
