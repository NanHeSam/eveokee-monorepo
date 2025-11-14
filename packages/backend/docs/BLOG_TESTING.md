# Blog System Testing Guide

This guide covers how to test the blog functionality we've built.

## Prerequisites

1. **Start Convex dev server:**
   ```bash
   pnpm dev:convex
   ```

2. **Ensure environment variables are set:**
   - `CONVEX_URL` (should be set automatically by Convex dev)

## Phase 1: Backend Testing (Convex Dashboard)

### 1.1 Test Blog Queries

Open Convex Dashboard → Functions → Run queries manually:

**Test `listPublished`:**
```javascript
// Should return all published blog posts
await ctx.runQuery(api.blog.listPublished, {});
```

**Expected:**
- ✅ Returns array of published posts
- ✅ Posts sorted by `publishedAt` descending
- ✅ Each post has: `_id`, `_creationTime`, `slug`, `title`, `bodyMarkdown`, `publishedAt`, etc.
- ✅ No `createdAt` field (uses `_creationTime` instead)

**Test `getBySlug`:**
```javascript
// Test with existing slug
await ctx.runQuery(api.blog.getBySlug, { 
  slug: "memory-soundtrack" 
});
```

**Expected:**
- ✅ Returns post object or `null`
- ✅ Post has all expected fields
- ✅ `bodyMarkdown` contains raw markdown (not HTML)

**Test `getPostBySlugForSeed`:**
```javascript
// Should work for any post (including drafts)
await ctx.runQuery(api.blog.getPostBySlugForSeed, { 
  slug: "memory-soundtrack" 
});
```

### 1.2 Test Blog Mutations

**Test `createDraft`:**
```javascript
await ctx.runMutation(api.blog.createDraft, {
  title: "Test Post",
  bodyMarkdown: "# Test\n\nThis is a test post.",
  excerpt: "A test post",
  author: "Test Author",
  tags: ["test"],
  readingTime: 2
});
```

**Expected:**
- ✅ Returns `{ postId: "..." }`
- ✅ Post created with `status: "draft"`
- ✅ `slug` is `undefined` (nullable for drafts)
- ✅ No `createdAt` field (uses `_creationTime`)

**Test `publish`:**
```javascript
// First get a draft post ID, then:
await ctx.runMutation(api.blog.publish, {
  postId: "your-post-id",
  slug: "test-post",
  publishedAt: Date.now() // Optional timestamp
});
```

**Expected:**
- ✅ Post status changes to `"published"`
- ✅ `slug` is set
- ✅ `publishedAt` is set

**Test `incrementViewCount`:**
```javascript
await ctx.runMutation(api.blog.incrementViewCount, {
  postId: "your-post-id",
  date: "2025-01-15" // YYYY-MM-DD format
});
```

**Expected:**
- ✅ Creates or increments analytics record
- ✅ View count increases

### 1.3 Test Analytics Queries

```javascript
// Get analytics for a specific post
await ctx.runQuery(api.blog.getPostAnalytics, {
  postId: "your-post-id"
});

// Get analytics for all posts
await ctx.runQuery(api.blog.getAllPostsAnalytics, {});
```

## Phase 2: Seed Script Testing

### 2.1 Clean Import Test

```bash
cd packages/backend
CONVEX_URL=https://artful-tiger-110.convex.cloud pnpm seed:blog:clean
```

**Expected Output:**
```
Found 5 markdown files to process

⚠️  --delete-existing flag detected. Deleting existing posts...
  ✓ Deleted: memory-soundtrack
  ✓ Deleted: memory-journaling-guide-2025
  ...

Deletion complete. Starting fresh import...

Processing: memory-soundtrack.md (slug: memory-soundtrack)
  - Creating new post: memory-soundtrack
  - Published: memory-soundtrack (2025-11-12)
  ✓ Success: memory-soundtrack
...
```

**Verify in Convex Dashboard:**
- ✅ All posts imported successfully
- ✅ Posts have correct `publishedAt` timestamps
- ✅ No `createdAt` field on new posts
- ✅ Posts are published (not drafts)

### 2.2 Verify No createdAt Field

```bash
CONVEX_URL=https://artful-tiger-110.convex.cloud npx tsx scripts/remove-createdAt.ts
```

**Expected:**
```
Total posts: 5
Posts with createdAt: 0

✓ All posts are clean - no createdAt field found!
```

## Phase 3: Web App Testing

### 3.1 Start Web Dev Server

```bash
pnpm dev:web
```

### 3.2 Test Blog Listing Page

Navigate to: `http://localhost:5173/blog`

**Expected:**
- ✅ Blog listing page loads
- ✅ Shows all published posts
- ✅ Posts sorted by date (newest first)
- ✅ Each post shows: title, excerpt, author, date, reading time, tags
- ✅ "Read full post →" links work
- ✅ Search functionality works

**Check Browser Console:**
- ✅ No errors
- ✅ Convex queries succeed
- ✅ View tracking fires (check Network tab for `incrementViewCount` calls)

### 3.3 Test Individual Blog Post

Navigate to: `http://localhost:5173/blog/memory-soundtrack`

**Expected:**
- ✅ Post page loads with full content
- ✅ Markdown renders correctly (headings, lists, links, etc.)
- ✅ Meta info shows: author, date, reading time, tags
- ✅ "Back to Blog" button works
- ✅ View count increments (check Convex dashboard analytics)

**Check Browser Console:**
- ✅ `window.__BLOG_INITIAL__` exists (if prerendered)
- ✅ No hydration mismatches
- ✅ View tracking mutation succeeds

### 3.4 Test 404 Handling

Navigate to: `http://localhost:5173/blog/non-existent-post`

**Expected:**
- ✅ Shows "Post Not Found" message
- ✅ "Back to Blog" link works
- ✅ No errors in console

### 3.5 Test Redirect Handling

If you have posts with `redirectFrom`:
1. Create a post with `redirectFrom: ["old-slug"]`
2. Navigate to `/blog/old-slug`
3. Should redirect to canonical post

## Phase 4: HTTP API Testing (Optional)

### 4.1 Test Blog API Endpoint

The HTTP endpoint requires HMAC authentication. Here's a test script:

```bash
# Generate HMAC signature (requires Node.js)
node -e "
const crypto = require('crypto');
const timestamp = Date.now().toString();
const body = JSON.stringify({ operation: 'createDraft', title: 'Test', bodyMarkdown: '# Test', author: 'Test' });
const secret = 'your-blog-api-key';
const payload = timestamp + '.' + body;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('X-Timestamp:', timestamp);
console.log('X-Signature:', signature);
console.log('Body:', body);
"
```

Then make request:
```bash
curl -X POST https://artful-tiger-110.convex.cloud/api/blog \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: <timestamp>" \
  -H "X-Signature: <signature>" \
  -d '{"operation":"createDraft","title":"Test","bodyMarkdown":"# Test","author":"Test"}'
```

**Expected:**
- ✅ Returns `{ success: true, result: { postId: "..." } }`
- ✅ Rejects requests with invalid signature
- ✅ Rejects requests with old timestamp (>10 min)

## Phase 5: Data Verification

### 5.1 Check Database Schema

In Convex Dashboard → Data → `blogPosts`:

**Verify:**
- ✅ Table exists with correct fields
- ✅ `createdAt` is optional (or removed if migration complete)
- ✅ `slug` can be null (for drafts)
- ✅ Indexes exist: `by_slug`, `by_status`, `by_publishedAt`

### 5.2 Check Sample Post

Pick a post and verify:
- ✅ All fields populated correctly
- ✅ `publishedAt` is a timestamp (number)
- ✅ `tags` is an array
- ✅ `bodyMarkdown` contains raw markdown
- ✅ `_creationTime` exists (Convex built-in)

### 5.3 Check Analytics

In Convex Dashboard → Data → `blogPostAnalytics`:

**Verify:**
- ✅ Records created when posts are viewed
- ✅ `viewCount` increments correctly
- ✅ `date` is in YYYY-MM-DD format

## Phase 6: Edge Cases

### 6.1 Test Slug Uniqueness

Try to publish two posts with the same slug:
```javascript
// Should fail with error
await ctx.runMutation(api.blog.publish, {
  postId: "post-1-id",
  slug: "duplicate-slug"
});

await ctx.runMutation(api.blog.publish, {
  postId: "post-2-id", 
  slug: "duplicate-slug" // Should error
});
```

**Expected:**
- ✅ Second publish fails with: `Slug "duplicate-slug" is already in use`

### 6.2 Test Draft Without Slug

```javascript
// Create draft (slug nullable)
const { postId } = await ctx.runMutation(api.blog.createDraft, {
  title: "Draft",
  bodyMarkdown: "# Draft",
  author: "Author",
  tags: []
});

// Try to publish without slug
await ctx.runMutation(api.blog.publish, {
  postId: postId
  // No slug provided, and post doesn't have one
});
```

**Expected:**
- ✅ Fails with: `Slug is required to publish`

### 6.3 Test Redirect Resolution

```javascript
// Create post with redirectFrom
await ctx.runMutation(api.blog.setRedirects, {
  postId: "post-id",
  redirectFrom: ["old-slug-1", "old-slug-2"]
});

// Query by old slug
await ctx.runQuery(api.blog.getBySlug, {
  slug: "old-slug-1"
});
```

**Expected:**
- ✅ Returns the canonical post (not null)

## Quick Test Checklist

- [ ] Convex dev server running
- [ ] Seed script imports all posts successfully
- [ ] No `createdAt` field on new posts
- [ ] Blog listing page shows all posts
- [ ] Individual post pages render correctly
- [ ] Markdown renders properly
- [ ] View tracking works
- [ ] 404 page works for non-existent posts
- [ ] Search functionality works
- [ ] Queries return correct data structure
- [ ] Mutations work (create, publish, update)
- [ ] Analytics increment correctly

## Troubleshooting

**Issue: Posts not showing up**
- Check Convex dashboard → Data → `blogPosts`
- Verify posts have `status: "published"` and `slug` is set
- Check browser console for query errors

**Issue: `createdAt` still appearing**
- Run `seed:blog:clean` again
- Verify schema has `createdAt` as optional
- Check `createDraft` mutation doesn't set it

**Issue: View tracking not working**
- Check browser console for mutation errors
- Verify `incrementViewCount` mutation exists
- Check Convex dashboard → Data → `blogPostAnalytics`

**Issue: Markdown not rendering**
- Check `bodyMarkdown` contains markdown (not HTML)
- Verify markdown rendering component is working
- Check for console errors in React component

