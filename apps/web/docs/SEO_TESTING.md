# Testing SEO Features Locally

This guide explains how to test the sitemap.xml, RSS feed, and JSON-LD structured data locally.

## Prerequisites

1. **Convex must be running** - The scripts need to fetch blog posts from Convex
2. **Environment variables set** - You need `VITE_CONVEX_URL` in your environment

## Step 1: Generate SEO Files

First, generate the sitemap and RSS feed files:

```bash
# From the repo root
cd apps/web

# Make sure you have VITE_CONVEX_URL set (or CONVEX_URL)
export VITE_CONVEX_URL="https://your-deployment.convex.cloud"

# Generate both sitemap and RSS
pnpm generate:seo

# Or generate individually:
pnpm generate:sitemap
pnpm generate:rss
```

The files will be created in `apps/web/public/`:
- `sitemap.xml`
- `rss.xml`
- `robots.txt` (already exists)

## Step 2: Test in Development Mode

Vite automatically serves files from the `public/` directory, so you can test immediately:

```bash
# Start the dev server
pnpm dev
# or from root: pnpm dev:web
```

Then visit:
- **Sitemap**: http://localhost:5173/sitemap.xml
- **RSS Feed**: http://localhost:5173/rss.xml
- **Robots.txt**: http://localhost:5173/robots.txt

### Verify Sitemap

1. Open http://localhost:5173/sitemap.xml in your browser
2. You should see XML with:
   - Static pages (/, /blog, /terms, /privacy)
   - All published blog posts with their URLs
   - Last modification dates
   - Change frequencies and priorities

### Verify RSS Feed

1. Open http://localhost:5173/rss.xml in your browser
2. You should see RSS 2.0 XML with:
   - Channel information (title, description, link)
   - Up to 20 most recent blog posts
   - Each post with title, link, description, pubDate, author, and tags

You can also test the RSS feed in an RSS reader:
- Add `http://localhost:5173/rss.xml` to your RSS reader
- Or use an online validator: https://validator.w3.org/feed/

## Step 3: Test JSON-LD Structured Data

JSON-LD structured data is embedded in the HTML pages. To verify:

### Test Homepage

1. Visit http://localhost:5173/
2. Open browser DevTools (F12)
3. Go to the Console tab and run:
   ```javascript
   // Find all JSON-LD scripts
   document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
     console.log(JSON.parse(script.textContent));
   });
   ```
4. You should see:
   - Organization schema
   - Website schema

### Test Blog Listing

1. Visit http://localhost:5173/blog
2. Open DevTools Console
3. Run the same JavaScript command above
4. You should see:
   - Blog schema with blog post listings

### Test Individual Blog Post

1. Visit any blog post: http://localhost:5173/blog/[slug]
2. Open DevTools Console
3. Run the same JavaScript command
4. You should see:
   - BlogPosting schema with article details

### Alternative: View Source

You can also view the page source (Ctrl+U / Cmd+U) and search for `application/ld+json` to see the structured data directly in the HTML.

### Validate with Google's Rich Results Test

1. Build the production version (see Step 4)
2. Use Google's Rich Results Test: https://search.google.com/test/rich-results
3. Enter your local URL (you may need to use ngrok or similar to expose it publicly)

## Step 4: Test Production Build

For a more accurate test of how it will work in production:

```bash
# Build the production version
pnpm build:prerender

# Preview the production build
pnpm preview
```

This will:
1. Build the app
2. Generate SSR entry
3. Prerender blog posts
4. Generate sitemap and RSS
5. Start a preview server (usually at http://localhost:4173)

Then test the same URLs:
- http://localhost:4173/sitemap.xml
- http://localhost:4173/rss.xml
- http://localhost:4173/robots.txt

## Step 5: Validate XML Files

### Validate Sitemap

Use an online validator:
- https://www.xml-sitemaps.com/validate-xml-sitemap.html
- Or use Google Search Console's sitemap tester

### Validate RSS Feed

Use an online validator:
- https://validator.w3.org/feed/
- Or test in an RSS reader

## Troubleshooting

### "Could not import Convex API" Error

Make sure Convex types are generated:
```bash
# From repo root
pnpm dev:convex
```

Or ensure `packages/backend/convex/_generated/api.js` exists.

### "CONVEX_URL not set" Error

Set the environment variable:
```bash
export VITE_CONVEX_URL="https://your-deployment.convex.cloud"
```

Or create a `.env.local` file in `apps/web/`:
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### Sitemap/RSS Not Updating

- Delete the old files: `rm apps/web/public/sitemap.xml apps/web/public/rss.xml`
- Regenerate: `pnpm generate:seo`
- Restart the dev server

### JSON-LD Not Showing

- Make sure you're viewing the actual page (not a 404)
- Check browser console for JavaScript errors
- Verify the StructuredData component is imported and used
- Check that `window.location.origin` is available (should work in browser)

## Quick Test Checklist

- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] RSS feed accessible at `/rss.xml`
- [ ] Robots.txt references sitemap
- [ ] Homepage has Organization and Website JSON-LD
- [ ] Blog listing has Blog JSON-LD
- [ ] Individual blog posts have BlogPosting JSON-LD
- [ ] All URLs in sitemap are valid
- [ ] RSS feed validates correctly
- [ ] RSS feed shows recent posts

