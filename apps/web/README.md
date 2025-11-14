Eveokee Landing Page

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
- `VITE_BASE_URL` or `BASE_URL`: Base URL for sitemap and RSS generation (defaults to `https://eveokee.com`).
- `VITE_REVENUECAT_PAYWALL_BASE_URL`: RevenueCat paywall base URL

SEO Features
- **Sitemap**: Automatically generated at `/sitemap.xml` during build. Run `pnpm generate:sitemap` to regenerate.
- **RSS Feed**: Automatically generated at `/rss.xml` during build. Run `pnpm generate:rss` to regenerate.
- **JSON-LD Structured Data**: Automatically added to blog posts, blog listing, and homepage for better search engine understanding.
- **robots.txt**: Located at `/robots.txt` and references the sitemap.

To generate SEO files manually:
- `pnpm generate:sitemap` - Generate sitemap.xml
- `pnpm generate:rss` - Generate RSS feed
- `pnpm generate:seo` - Generate both sitemap and RSS feed

These are automatically generated during `pnpm build:prerender`.