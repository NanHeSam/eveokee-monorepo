# Blog Draft Review E2E Test Explanation

## Overview

The E2E tests in `blogDraftReview.e2e.test.ts` simulate the complete blog draft review workflow from receiving a RankPill webhook to approving/dismissing drafts via Slack.

---

## Test Scenarios

### 1. **Full RankPill → Slack Flow** (Main E2E Test)
Tests the complete workflow:
```
RankPill Webhook → Create Draft → Send Slack Notification → Interactive Buttons
```

### 2. **Draft Update Flow**
Tests that duplicate slugs update existing drafts instead of creating new ones

### 3. **Approve Draft Flow**
Tests approving a draft and publishing it

### 4. **Dismiss Draft Flow**
Tests dismissing a draft and deleting it

### 5. **Full Metadata Handling**
Tests all optional fields in RankPill payload

---

## What's REAL (Actually Executed)

### ✅ Real Convex Database
- Uses `convex-test` with **in-memory database**
- Schema is real (same as production)
- All database operations are real:
  - Inserts to `blogPosts` table
  - Queries by preview token
  - Updates and deletes
  - Index lookups

### ✅ Real Convex Functions
All Convex queries, mutations, and actions run with real logic:

**Actions:**
- `internal.blogAuth.generatePreviewToken` - Real token generation
- `api.utils.slack.sendDraftReviewNotification` - Real Slack message building
- `api.blog.createDraft` - Real draft creation
- `api.blog.updateDraft` - Real draft updates
- `internal.blog.approveDraft` - Real publish logic
- `internal.blog.dismissDraft` - Real delete logic

**Queries:**
- `api.blog.getDraftByPreviewToken` - Real query
- `api.blog.getBySlug` - Real published post lookup
- `internal.blog.findDraftBySlugOrTitle` - Real duplicate detection

### ✅ Real Business Logic
- Preview token generation (crypto)
- Slug generation and validation
- Draft vs published status transitions
- Button value format (`postId:token`)
- Slack message block structure
- Draft lifecycle management

### ✅ Real Data Validation
- Convex validators run on all inputs
- Type checking for arguments
- Schema validation

---

## What's MOCKED (Simulated)

### 🔧 Mocked External Services

#### 1. **Slack HTTP Requests**
```typescript
global.fetch = vi.fn((url: string | URL, options?: RequestInit) => {
  if (typeof url === "string" && url.includes("slack")) {
    slackCalls.push({
      url,
      payload: options?.body ? JSON.parse(options.body as string) : null,
    });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    } as Response);
  }
  return originalFetch(url, options);
});
```

**Why mocked:**
- Avoid sending real Slack messages during tests
- Avoid rate limits
- Tests can run offline
- Faster execution

**What we verify:**
- Slack webhook URL is called
- Message payload structure is correct
- Button values have correct format (`postId:token`)
- Block structure matches Slack API requirements

#### 2. **Environment Variables**
```typescript
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK/URL";
```

**Why mocked:**
- Tests don't require production credentials
- Portable across different environments
- No secrets needed in CI/CD

### 🔧 Mocked/Simulated User Input

#### 1. **RankPill Webhook Payload**
```typescript
const rankPillPayload = {
  title: "Test Article from RankPill",
  content_html: "<h2>This is a test article</h2>...",
  content_markdown: "## This is a test article\n\n...",
  slug: "test-article-from-rankpill",
  // ... etc
};
```

**Why simulated:**
- We don't call the actual HTTP webhook endpoint
- We directly call the internal functions
- Payload is manually constructed based on real RankPill data

**What's real:**
- The payload structure matches real RankPill webhooks
- The data processing logic is real

#### 2. **HTML to Markdown Conversion**
```typescript
// In real flow, this happens in blogApiHandler using Turndown
const bodyMarkdown = rankPillPayload.content_markdown;
```

**Why skipped:**
- Tests focus on draft management, not HTML parsing
- Turndown library is tested separately
- Reduces test complexity

### 🔧 What's NOT Tested (Integration Points)

#### 1. **HTTP Webhook Endpoints**
The actual HTTP handlers are **NOT** tested:
- `blogApiHandler` (POST /webhooks/rankpill)
- `slackInteractiveHandler` (POST /webhooks/slack/interactive)

**Why:**
- `convex-test` doesn't support HTTP action testing
- These are thin wrappers around internal functions
- We test the internal functions they call

**What we DO test:**
- All the logic inside those handlers
- The functions they call (mutations, queries, actions)

#### 2. **Slack Interactive Button Clicks**
User clicking buttons in Slack is **NOT** simulated

**Why:**
- Would require calling HTTP endpoint with form-encoded payload
- We test the approve/dismiss mutations directly instead

**Alternative:**
- The **unit tests** test the Slack payload parsing with real fixture data

#### 3. **Real Network Requests**
- No real HTTP calls to Slack
- No real HTTP calls from RankPill
- No external API calls

---

## Test Environment Setup

### How `convex-test` Works

```typescript
const t = createTestEnvironment();
```

This creates an **isolated, in-memory Convex backend**:

1. **In-Memory Database**
   - Fresh database for each test
   - No persistence between tests
   - Uses real schema validation

2. **Real Runtime**
   - Functions execute with real logic
   - Validators run
   - Indexes work
   - Transactions work

3. **No HTTP Layer**
   - Can't test HTTP actions directly
   - Can test queries, mutations, and actions
   - Can call internal functions

---

## Example Test Flow Breakdown

### Test: "should approve draft and publish it"

```typescript
it("should approve draft and publish it", async () => {
  const t = createTestEnvironment();  // ← REAL: Fresh in-memory DB

  // REAL: Generate actual preview token using crypto
  const previewToken = await t.action(internal.blogAuth.generatePreviewToken);

  // REAL: Insert into database with actual schema validation
  const createResult = await t.mutation(api.blog.createDraft, {
    title: "Draft to Approve",
    bodyMarkdown: "This draft will be approved",
    slug: "draft-to-approve",
    author: "Sam He",
    tags: [],
    draftPreviewToken: previewToken,
  });

  // REAL: Run actual publish mutation (updates DB, changes status)
  await t.mutation(internal.blog.approveDraft, {
    postId: createResult.postId,
    slug: "draft-to-approve",
  });

  // REAL: Query database with actual index lookup
  const publishedPost = await t.query(api.blog.getBySlug, {
    slug: "draft-to-approve",
  });

  // REAL: Verify actual database state
  expect(publishedPost).not.toBeNull();
  expect(publishedPost?.title).toBe("Draft to Approve");

  // REAL: Verify draft is actually deleted from preview token index
  const draftByToken = await t.query(api.blog.getDraftByPreviewToken, {
    previewToken,
  });
  expect(draftByToken).toBeNull();
});
```

**What's Real:**
- ✅ Database operations
- ✅ Schema validation
- ✅ Business logic
- ✅ Token generation
- ✅ Status transitions

**What's Mocked:**
- 🔧 Nothing in this test! It's all real except for the isolated environment

---

## Comparison: E2E vs Unit Tests

### E2E Tests (`blogDraftReview.e2e.test.ts`)
**Focus:** Full workflow integration
- Tests multiple functions working together
- Tests database state changes
- Tests the entire draft lifecycle
- Uses real Convex runtime

**Example:** Create draft → verify it exists → approve it → verify it's published

### Unit Tests (`blogDraftReview.unit.test.ts`)
**Focus:** Individual helper functions
- Tests one function at a time
- Tests parsing and validation logic
- Uses real Slack payload fixtures
- No database involved

**Example:** Parse button value string → verify postId and token are extracted correctly

---

## What Makes This an "E2E" Test?

It's called **E2E** (End-to-End) because it tests:

1. **End:** RankPill webhook data arrives
2. **Through:** Multiple Convex functions (create, query, notify, approve/dismiss)
3. **End:** Draft is published/deleted and verified in database

However, it's **not a full system E2E** because:
- ❌ No real HTTP requests
- ❌ No real Slack integration
- ❌ No real frontend interaction

It's more accurately a **Convex Backend Integration Test**.

---

## Summary Table

| Component | Status | Notes |
|-----------|--------|-------|
| **Convex Database** | ✅ Real | In-memory, isolated per test |
| **Convex Functions** | ✅ Real | All queries/mutations/actions execute |
| **Business Logic** | ✅ Real | Draft lifecycle, validation, etc. |
| **Schema Validation** | ✅ Real | Convex validators run |
| **Slack HTTP Calls** | 🔧 Mocked | Intercept fetch, verify payload |
| **RankPill HTTP Webhook** | 🔧 Simulated | Call internal functions directly |
| **HTTP Handlers** | ❌ Not Tested | convex-test limitation |
| **Slack Button Clicks** | 🔧 Unit Tested | See `blogDraftReview.unit.test.ts` |
| **HTML Parsing** | 🔧 Skipped | Use markdown directly |
| **Environment Variables** | 🔧 Mocked | Fake webhook URL |

---

## Benefits of This Approach

1. **Fast** - No network calls, runs in ~30ms
2. **Reliable** - No external dependencies
3. **Isolated** - Each test has fresh database
4. **Debuggable** - Can inspect database state at any point
5. **Comprehensive** - Tests real business logic and data flow

## Limitations

1. **No HTTP Testing** - Can't test the actual webhook endpoints
2. **No Real Slack** - Can't verify actual Slack message appearance
3. **No External Validation** - Assumes RankPill payload format is correct

These limitations are acceptable because:
- The HTTP handlers are thin wrappers
- Unit tests validate Slack payload parsing with real fixtures
- The business logic (which is complex) is thoroughly tested
