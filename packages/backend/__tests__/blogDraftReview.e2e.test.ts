import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { createTestEnvironment } from "./convexTestUtils";
import { createHmac } from "crypto";

/**
 * E2E Test for Blog Draft Review Flow
 * 
 * This test simulates the full RankPill webhook flow:
 * 1. RankPill sends article data
 * 2. System creates/updates draft
 * 3. System sends Slack notification
 * 4. Preview URL is generated
 * 5. Draft can be approved/dismissed
 * 
 * Note: Since convex-test doesn't support HTTP actions directly,
 * we test the internal functions that the HTTP handler calls.
 */

describe("Blog Draft Review E2E Flow", () => {
  // Mock Slack webhook to avoid sending real notifications during tests
  const originalFetch = global.fetch;
  const originalEnv = process.env.SLACK_WEBHOOK_URL;
  let slackCalls: Array<{ url: string; payload: any }> = [];

  beforeEach(() => {
    slackCalls = [];
    // Set fake Slack webhook URL for tests
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK/URL";

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.SLACK_WEBHOOK_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("should create draft from RankPill payload and send Slack notification", async () => {
    const t = createTestEnvironment();

    // Sample RankPill payload (from user's request)
    const rankPillPayload = {
      title: "Test Article from RankPill",
      content_html:
        "<h2>This is a test article</h2><p>This is a test payload sent from RankPill to verify your webhook integration is working correctly.</p><p>When you publish real articles, you'll receive the actual article data including:</p><ul><li>Full HTML and Markdown content</li><li>Featured images</li><li>Meta descriptions</li><li>Published URLs</li><li>And more!</li></ul>",
      content_markdown:
        "## This is a test article\n\nThis is a test payload sent from RankPill to verify your webhook integration is working correctly.\n\nWhen you publish real articles, you'll receive the actual article data including:\n\n- Full HTML and Markdown content\n- Featured images\n- Meta descriptions\n- Published URLs\n- And more!",
      slug: "test-article-from-rankpill",
      meta_description:
        "This is a test article to verify your RankPill webhook integration.",
      status: "published",
      featured_image:
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200",
      published_url: "https://your-site.com/blog/test-article-from-rankpill",
      published_at: "2025-11-13T08:28:58.765Z",
      test: true,
    };

    // Step 1: Generate preview token (simulating what blogApiHandler does)
    const previewToken = await t.action(
      internal.blogAuth.generatePreviewToken
    );

    expect(previewToken).toBeDefined();
    expect(typeof previewToken).toBe("string");
    expect(previewToken.length).toBeGreaterThan(0);

    // Step 2: Convert HTML to markdown (simulating turndown conversion)
    // In real flow, this happens in blogApiHandler, but for testing we use the markdown directly
    const bodyMarkdown = rankPillPayload.content_markdown;

    // Step 3: Extract metadata
    const slug = rankPillPayload.slug || "test-article-from-rankpill";
    const author = rankPillPayload.author || "Sam He";
    const excerpt =
      rankPillPayload.excerpt ||
      rankPillPayload.description ||
      rankPillPayload.meta_description ||
      undefined;
    const canonicalUrl =
      rankPillPayload.canonical_url ||
      rankPillPayload.canonicalUrl ||
      rankPillPayload.published_url ||
      undefined;

    // Convert published_at to timestamp
    let publishedAt: number | undefined = undefined;
    if (rankPillPayload.published_at) {
      publishedAt = new Date(rankPillPayload.published_at).getTime();
    }

    // Step 4: Check for existing draft
    const existingDraft = await t.query(internal.blog.findDraftBySlugOrTitle, {
      slug: rankPillPayload.slug,
      title: rankPillPayload.title,
    });

    expect(existingDraft).toBeNull(); // Should not exist for new test

    // Step 5: Create draft
    const createResult = await t.mutation(api.blog.createDraft, {
      title: rankPillPayload.title,
      bodyMarkdown,
      excerpt,
      author,
      tags: [], // Empty tags for this test
      readingTime: rankPillPayload.reading_time || undefined,
      canonicalUrl,
      slug,
      featuredImage: rankPillPayload.featured_image || undefined,
      publishedAt,
      draftPreviewToken: previewToken,
    });

    expect(createResult.postId).toBeDefined();

    // Step 6: Verify draft was created
    const draft = await t.query(api.blog.getDraftByPreviewToken, {
      previewToken,
    });

    expect(draft).toBeDefined();
    expect(draft?.title).toBe(rankPillPayload.title);
    expect(draft?.status).toBe("draft");
    expect(draft?.slug).toBe(slug);
    expect(draft?.excerpt).toBe(excerpt);

    // Step 7: Generate preview URL (simulating what blogApiHandler does)
    const frontendBaseUrl = "http://localhost:5173"; // Dev URL
    const previewUrl = `${frontendBaseUrl}/blog/preview/${previewToken}`;

    expect(previewUrl).toContain("/blog/preview/");
    expect(previewUrl).toContain(previewToken);

    // Step 8: Send Slack notification
    const slackResult = await t.action(
      api.utils.slack.sendDraftReviewNotification,
      {
        postId: createResult.postId,
        title: rankPillPayload.title,
        previewUrl,
        previewToken,
      }
    );

    expect(slackResult.success).toBe(true);

    // Step 9: Verify Slack notification was sent with correct data
    expect(slackCalls).toHaveLength(1);
    const slackPayload = slackCalls[0].payload;
    expect(slackPayload).toBeDefined();
    expect(slackPayload.text).toContain(rankPillPayload.title);
    expect(slackPayload.blocks).toBeDefined();
    expect(slackPayload.blocks.length).toBeGreaterThan(0);

    // Verify header contains [dev] prefix (since SHARE_BASE_URL contains localhost)
    const headerBlock = slackPayload.blocks.find(
      (b: any) => b.type === "header"
    );
    expect(headerBlock).toBeDefined();
    expect(headerBlock.text.text).toContain("[dev]");
    expect(headerBlock.text.text).toContain("New Blog Draft Ready for Review");

    // Verify preview URL is in the message
    const previewBlock = slackPayload.blocks.find(
      (b: any) => b.text?.text?.includes("Preview Draft")
    );
    expect(previewBlock).toBeDefined();
    expect(previewBlock.text.text).toContain(previewUrl);

    // Verify buttons are present
    const actionsBlock = slackPayload.blocks.find(
      (b: any) => b.type === "actions"
    );
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements).toHaveLength(2);
    expect(actionsBlock.elements[0].action_id).toBe("approve_draft");
    expect(actionsBlock.elements[1].action_id).toBe("dismiss_draft");

    // Verify button values contain postId:token format
    const buttonValue = `${createResult.postId}:${previewToken}`;
    expect(actionsBlock.elements[0].value).toBe(buttonValue);
    expect(actionsBlock.elements[1].value).toBe(buttonValue);
  });

  it("should update existing draft when slug matches", async () => {
    const t = createTestEnvironment();

    const firstPayload = {
      title: "Existing Draft Article",
      content_markdown: "First version",
      slug: "existing-draft-article",
    };

    // Create first draft
    const previewToken1 = await t.action(
      internal.blogAuth.generatePreviewToken
    );
    const result1 = await t.mutation(api.blog.createDraft, {
      title: firstPayload.title,
      bodyMarkdown: firstPayload.content_markdown,
      slug: firstPayload.slug,
      author: "Sam He",
      tags: [],
      draftPreviewToken: previewToken1,
    });

    // Try to create again with same slug (simulating RankPill update)
    const previewToken2 = await t.action(
      internal.blogAuth.generatePreviewToken
    );
    const existingDraft = await t.query(internal.blog.findDraftBySlugOrTitle, {
      slug: firstPayload.slug,
      title: firstPayload.title,
    });

    expect(existingDraft).toBeDefined();
    expect(existingDraft?._id).toBe(result1.postId);

    // Update existing draft
    await t.mutation(api.blog.updateDraft, {
      postId: result1.postId,
      title: "Updated Draft Article",
      bodyMarkdown: "Updated version",
      author: "Sam He",
      tags: [],
      draftPreviewToken: previewToken2,
    });

    // Verify draft was updated
    const updatedDraft = await t.query(api.blog.getDraftByPreviewToken, {
      previewToken: previewToken2,
    });

    expect(updatedDraft).toBeDefined();
    expect(updatedDraft?.title).toBe("Updated Draft Article");
    expect(updatedDraft?.bodyMarkdown).toBe("Updated version");
  });

  it("should approve draft and publish it", async () => {
    const t = createTestEnvironment();

    // Create a draft
    const previewToken = await t.action(internal.blogAuth.generatePreviewToken);
    const createResult = await t.mutation(api.blog.createDraft, {
      title: "Draft to Approve",
      bodyMarkdown: "This draft will be approved",
      slug: "draft-to-approve",
      author: "Sam He",
      tags: [],
      draftPreviewToken: previewToken,
    });

    // Approve the draft (simulating what approveDraftHandler does)
    await t.mutation(internal.blog.approveDraft, {
      postId: createResult.postId,
      slug: "draft-to-approve",
    });

    // Verify draft is now published (getBySlug only returns published posts)
    const publishedPost = await t.query(api.blog.getBySlug, {
      slug: "draft-to-approve",
    });

    expect(publishedPost).toBeDefined();
    expect(publishedPost).not.toBeNull();
    expect(publishedPost?.title).toBe("Draft to Approve");
    expect(publishedPost?.slug).toBe("draft-to-approve");

    // Verify draft can no longer be accessed by preview token
    const draftByToken = await t.query(api.blog.getDraftByPreviewToken, {
      previewToken,
    });
    expect(draftByToken).toBeNull();
  });

  it("should dismiss draft and delete it", async () => {
    const t = createTestEnvironment();

    // Create a draft
    const previewToken = await t.action(internal.blogAuth.generatePreviewToken);
    const createResult = await t.mutation(api.blog.createDraft, {
      title: "Draft to Dismiss",
      bodyMarkdown: "This draft will be dismissed",
      slug: "draft-to-dismiss",
      author: "Sam He",
      tags: [],
      draftPreviewToken: previewToken,
    });

    // Dismiss the draft (simulating what dismissDraftHandler does)
    await t.mutation(internal.blog.dismissDraft, {
      postId: createResult.postId,
    });

    // Verify draft no longer exists
    const draftByToken = await t.query(api.blog.getDraftByPreviewToken, {
      previewToken,
    });
    expect(draftByToken).toBeNull();

    // Verify post doesn't exist in database
    const post = await t.run(async (ctx) => {
      return await ctx.db.get(createResult.postId);
    });
    expect(post).toBeNull();
  });

  it("should handle RankPill payload with all optional fields", async () => {
    const t = createTestEnvironment();

    const fullPayload = {
      title: "Full Featured Article",
      content_html: "<h1>Full Article</h1><p>Content</p>",
      content_markdown: "# Full Article\n\nContent",
      slug: "full-featured-article",
      meta_description: "A full featured article",
      status: "published",
      featured_image: "https://example.com/image.jpg",
      published_url: "https://example.com/blog/full-featured-article",
      published_at: "2025-11-13T08:28:58.765Z",
      author: "Test Author",
      tags: ["tech", "ai"],
      reading_time: 5,
      canonical_url: "https://example.com/blog/full-featured-article",
    };

    const previewToken = await t.action(
      internal.blogAuth.generatePreviewToken
    );

    const result = await t.mutation(api.blog.createDraft, {
      title: fullPayload.title,
      bodyMarkdown: fullPayload.content_markdown,
      excerpt: fullPayload.meta_description,
      author: fullPayload.author,
      tags: fullPayload.tags,
      readingTime: fullPayload.reading_time,
      canonicalUrl: fullPayload.canonical_url,
      slug: fullPayload.slug,
      featuredImage: fullPayload.featured_image,
      publishedAt: new Date(fullPayload.published_at).getTime(),
      draftPreviewToken: previewToken,
    });

    const draft = await t.query(api.blog.getDraftByPreviewToken, {
      previewToken,
    });

    expect(draft).toBeDefined();
    expect(draft?.title).toBe(fullPayload.title);
    expect(draft?.excerpt).toBe(fullPayload.meta_description);
    expect(draft?.author).toBe(fullPayload.author);
    expect(draft?.tags).toEqual(fullPayload.tags);
    expect(draft?.readingTime).toBe(fullPayload.reading_time);
    expect(draft?.canonicalUrl).toBe(fullPayload.canonical_url);
    expect(draft?.featuredImage).toBe(fullPayload.featured_image);
  });
});

