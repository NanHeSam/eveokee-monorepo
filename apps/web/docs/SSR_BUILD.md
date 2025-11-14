# SSR Build and Blog Prerendering

This guide explains how the SSR (Server-Side Rendering) build and blog post prerendering works in this project.

## Overview

The project uses a custom SSR/prerendering approach that:
1. Builds a separate SSR entry point that can render React components to HTML strings
2. Compiles this entry point to Node.js-compatible JavaScript
3. Uses it to generate static HTML files for blog posts at build time
4. Embeds initial data for client-side hydration

## Build Process

The full build process is orchestrated by `build:prerender`:

```bash
pnpm build:prerender
```

This runs four steps in sequence:

### 1. Type Checking (`tsc -b`)

- Type checks the entire codebase using TypeScript's build mode
- Uses incremental builds for faster subsequent runs
- Catches type errors before the build continues
- No files are emitted (due to `noEmit: true` in `tsconfig.json`)

### 2. Client Build (`vite build`)

- Builds the entire client-side React application
- Bundles React components, assets, and dependencies
- Outputs production-ready files to `dist/`
- Creates the base `dist/index.html` that will be used as a template for prerendered pages

### 3. SSR Entry Build (`pnpm build:ssr`)

Runs `scripts/build-ssr-entry.mjs` which:

1. **Type checks** the SSR entry point using `tsconfig.ssr.json`
2. **Bundles** `src/entry-blog-ssr.tsx` with esbuild to create `dist-ssr/entry-blog-ssr.js`
   - Format: ESM (ES Modules)
   - Platform: Node.js
   - Target: Node 18
   - Keeps packages external (React, Convex, etc.)

The SSR entry exports two functions:
- `renderBlogPost(post)` - Renders a blog post component to HTML string
- `renderBlogListing(posts)` - Renders the blog listing page to HTML string

### 4. Prerender Blog Posts (`pnpm prerender:blog`)

Runs `scripts/prerender-blog.mjs` which:

1. **Loads dependencies:**
   - Imports the compiled SSR entry from `dist-ssr/entry-blog-ssr.js`
   - Loads Convex API to fetch blog posts

2. **Fetches blog posts:**
   - Connects to Convex using `CONVEX_URL` or `VITE_CONVEX_URL`
   - Queries `api.blog.listPublished` for all published posts
   - Filters posts that have slugs

3. **For each blog post:**
   - Creates initial data structure for hydration
   - Renders the component to HTML using `renderBlogPost()`
   - Escapes JSON data to prevent XSS
   - Injects rendered HTML into the base `index.html`
   - Adds a `<script>` tag with `window.__BLOG_INITIAL__` for hydration
   - Updates meta tags (title, description, canonical URL)
   - Saves to `dist/blog/[slug]/index.html`

4. **Prerenders blog listing:**
   - Renders the listing page using `renderBlogListing()`
   - Saves to `dist/blog/index.html`

## File Structure

```
apps/web/
├── src/
│   └── entry-blog-ssr.tsx          # SSR entry point (exports render functions)
├── scripts/
│   ├── build-ssr-entry.mjs         # Builds SSR entry to dist-ssr/
│   └── prerender-blog.mjs          # Generates static HTML files
├── dist/                            # Production build output
│   ├── index.html                   # Base SPA template
│   └── blog/
│       ├── index.html               # Blog listing (prerendered)
│       └── [slug]/
│           └── index.html           # Individual posts (prerendered)
└── dist-ssr/
    └── entry-blog-ssr.js            # Compiled SSR entry (Node.js ESM)
```

## Key Components

### SSR Entry Point (`src/entry-blog-ssr.tsx`)

Exports pure functions that render React components to HTML strings:

```typescript
export function renderBlogPost(post: BlogPostType): string
export function renderBlogListing(posts: BlogPostType[]): string
```

Uses `react-dom/server`'s `renderToString()` to convert React components to HTML.

### Build Script (`scripts/build-ssr-entry.mjs`)

- Type checks with `tsconfig.ssr.json`
- Bundles with esbuild to Node.js-compatible ESM
- Outputs to `dist-ssr/entry-blog-ssr.js`

### Prerender Script (`scripts/prerender-blog.mjs`)

- Fetches blog posts from Convex
- Uses SSR functions to render HTML
- Injects HTML and metadata into base template
- Saves static files for deployment

## Prerequisites

1. **Convex deployment running** (for fetching blog posts)
2. **Environment variable set:**
   - `CONVEX_URL` or `VITE_CONVEX_URL` - Your Convex deployment URL
3. **Convex types generated:**
   - Run `pnpm dev:convex` to generate types
   - Or ensure `packages/backend/convex/_generated/api.js` exists

## Usage

### Local Development

```bash
# Set Convex URL
export CONVEX_URL=https://your-deployment.convex.cloud

# Run full build with prerendering
pnpm build:prerender

# Or run steps individually
pnpm build                    # Type check + Vite build
pnpm build:ssr                # Build SSR entry
pnpm prerender:blog           # Generate static HTML files
```

### Preview Locally

```bash
pnpm preview
```

Visit `http://localhost:4173/blog/[slug]` to see prerendered content.

### Verify Prerendering

1. **Check build output:**
   ```bash
   ls -la dist/blog/
   ```

2. **Inspect HTML files:**
   - Open `dist/blog/[slug]/index.html`
   - Should contain full blog post content in the HTML
   - Should have `window.__BLOG_INITIAL__` script tag
   - Should have proper meta tags

3. **Check Network tab:**
   - On first load, content should appear immediately
   - No waiting for Convex queries (data is embedded)

## How It Works in Production (Vercel)

**Prerendering runs automatically on Vercel deploy!**

### Automatic Prerendering

1. **Build Process:**
   - Vercel runs `pnpm --filter web build:prerender` (from `vercel.json`)
   - All four build steps execute in sequence
   - Static HTML files are generated in `dist/blog/`

2. **File Serving:**
   - Vercel automatically serves prerendered files
   - `/blog/[slug]` → `dist/blog/[slug]/index.html`
   - `/blog` → `dist/blog/index.html`
   - Falls back to SPA (`/index.html`) for non-blog routes

3. **Client Hydration:**
   - Browser loads prerendered HTML immediately
   - React hydrates using `window.__BLOG_INITIAL__` data
   - No additional Convex queries needed for initial render

### Required Vercel Environment Variables

- `VITE_CONVEX_URL` - Your Convex deployment URL (required for prerendering)

## Security Features

1. **XSS Prevention:**
   - HTML content is escaped using `escapeHtml()`
   - JSON in script tags is escaped using `escapeJsonForScript()`
   - Prevents `</script>` injection attacks

2. **Type Safety:**
   - SSR entry is type-checked separately with `tsconfig.ssr.json`
   - Ensures type safety for SSR rendering functions

## Troubleshooting

### Issue: SSR entry not found

**Error:** `Compiled SSR entry not found`

**Solution:**
- Run `pnpm build:ssr` first
- Or run `pnpm build:prerender` (includes SSR build)

### Issue: Convex API not found

**Error:** `Could not import Convex API`

**Solution:**
- Run `pnpm dev:convex` to generate types
- Ensure `packages/backend/convex/_generated/api.js` exists
- Check that Convex is properly configured

### Issue: No blog posts prerendered

**Error:** `No published posts found`

**Solution:**
- Verify `CONVEX_URL` is set correctly
- Check that blog posts exist in Convex database
- Ensure posts have `slug` field set
- Verify posts are marked as published

### Issue: Prerendered pages show loading state

**Solution:**
- Check that `window.__BLOG_INITIAL__` is present in HTML
- Verify client-side code reads from `window.__BLOG_INITIAL__`
- Check browser console for hydration errors

### Issue: Build fails on Vercel

**Solution:**
- Verify `VITE_CONVEX_URL` is set in Vercel environment variables
- Check Vercel build logs for specific errors
- Ensure Convex deployment is accessible from Vercel's build environment
- Verify all dependencies are in `package.json`

## Related Files

- `apps/web/src/entry-blog-ssr.tsx` - SSR entry point
- `apps/web/scripts/build-ssr-entry.mjs` - SSR build script
- `apps/web/scripts/prerender-blog.mjs` - Prerender script
- `apps/web/tsconfig.ssr.json` - TypeScript config for SSR entry
- `apps/web/vite.config.ts` - Vite configuration
- `apps/web/vercel.json` - Vercel deployment configuration
- `apps/web/src/components/BlogPost.tsx` - Blog post component
- `apps/web/src/components/BlogListing.tsx` - Blog listing component

## Advantages of This Approach

1. **Full Control** - Custom script gives complete control over prerendering process
2. **Type Safety** - SSR entry is type-checked separately
3. **SEO Optimized** - Meta tags are injected per post
4. **Fast Initial Load** - Content is embedded in HTML, no waiting for API calls
5. **Client Hydration** - React hydrates seamlessly with embedded data
6. **Security** - XSS protection built into HTML/JSON escaping

