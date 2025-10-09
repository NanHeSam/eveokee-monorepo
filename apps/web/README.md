Diary Vibes Landing Page

Setup
- Install dependencies: `npm install`
- Development server: `npm run dev` (Vite at `http://localhost:5173`)

Sentry Integration
- Set `VITE_SENTRY_DSN` in your environment (e.g., `.env.local`).
- Optional: adjust `tracesSampleRate`, `replaysSessionSampleRate`, and `replaysOnErrorSampleRate` in `src/main.tsx`.
- Error capture helper available: `captureError(error, context?)` from `src/lib/utils.ts`.

Environment variables
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key.
- `VITE_CONVEX_URL`: Convex deployment URL.
- `VITE_SENTRY_DSN`: Sentry DSN.