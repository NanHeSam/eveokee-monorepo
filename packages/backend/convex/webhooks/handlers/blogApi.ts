/**
 * Blog API HTTP endpoint with HMAC authentication
 * Allows external automation to manage blog posts
 */
import { httpAction } from "../../_generated/server";
import { api } from "../../_generated/api";
import { internal } from "../../_generated/api";
import {
  createWebhookLogger,
  errorResponse,
  successResponse,
  validateHttpMethod,
} from "../shared";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  BLOG_DRAFT_APPROVE_PATH,
  BLOG_DRAFT_DISMISS_PATH,
} from "../../utils/constants/webhooks";
import { logWebhookEvent } from "../../utils/logger";
import { generateSlug, normalizeTagsField } from "../../utils/blogHelpers";
import TurndownService from "turndown";

/**
 * RankPill webhook payload format
 * Represents the article data structure sent by RankPill
 */
interface RankPillPayload {
  title: string;
  content_html: string;
  content_markdown?: string;
  slug?: string;
  meta_description?: string;
  status?: string;
  featured_image?: string;
  published_url?: string;
  published_at?: string; // ISO date string
  test?: boolean;
  author?: string;
  tags?: string | string[];
  tag?: string | string[];
  excerpt?: string;
  description?: string;
  canonical_url?: string;
  canonicalUrl?: string;
  reading_time?: number;
}

// Configure TurndownService with options optimized for blog content
const turndownService = new TurndownService({
  headingStyle: "atx", // Use # for headings (more consistent)
  bulletListMarker: "-", // Use - for bullet lists
  codeBlockStyle: "fenced", // Use ``` for code blocks
  emDelimiter: "*", // Use * for emphasis
  strongDelimiter: "**", // Use ** for strong
});

/**
 * Blog API HTTP handler
 * Supports operations: createDraft, updateDraft, publish, archive, setRedirects
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Log incoming request details
 * 3. Extract HMAC signature from RankPill headers (x-rankpill-signature or authorization)
 * 4. Verify RankPill HMAC signature (body-only, no timestamp)
 * 5. Parse and validate JSON payload
 * 6. Execute requested operation
 */
export const blogApiHandler = httpAction(async (ctx, request) => {
  // Initialize structured logger
  const logger = createWebhookLogger("blogApiHandler");
  logger.startTimer();
  logWebhookEvent(logger, "blogApi", "received");

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(request);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: request.method });
    return methodError;
  }

  // Step 2: Log incoming request details
  const headers: Record<string, string> = {};
  const sensitiveHeaders = ["x-rankpill-signature", "X-RankPill-Signature", "X-RANKPILL-SIGNATURE", "authorization", "Authorization"];
  
  request.headers.forEach((value, key) => {
    // Redact sensitive headers
    if (sensitiveHeaders.some(h => h.toLowerCase() === key.toLowerCase())) {
      headers[key] = "[REDACTED]";
    } else {
      headers[key] = value;
    }
  });
  
  // Read body for logging and verification
  const body = await request.text();
  
  logger.info("Blog API request received", {
    method: request.method,
    url: request.url,
    headers,
    bodyLength: body.length,
  });

  // Step 3: Get HMAC secret from environment
  const hmacSecret = process.env.BLOG_WEBHOOK_HMAC_SECRET;
  if (!hmacSecret) {
    logger.error("BLOG_WEBHOOK_HMAC_SECRET environment variable not set");
    return errorResponse("Server configuration error", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  // Step 4: Extract signature from RankPill headers
  // RankPill sends signature in x-rankpill-signature header or authorization header (sha256=...)
  let signature: string | null = null;
  
  // Try x-rankpill-signature header (case-insensitive)
  const rankPillSignature = request.headers.get("x-rankpill-signature") || 
                            request.headers.get("X-RankPill-Signature") ||
                            request.headers.get("X-RANKPILL-SIGNATURE");
  
  if (rankPillSignature) {
    signature = rankPillSignature;
  } else {
    // Fall back to authorization header (format: sha256=...)
    const authHeader = request.headers.get("authorization") || 
                      request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("sha256=")) {
      signature = authHeader.substring(7); // Remove "sha256=" prefix
    }
  }

  if (!signature) {
    logger.warn("Missing signature header", {
      hasRankPillSignature: !!rankPillSignature,
      hasAuthHeader: !!request.headers.get("authorization"),
      availableHeaders: Object.keys(headers),
    });
    return errorResponse("Missing x-rankpill-signature or authorization header", HTTP_STATUS_UNAUTHORIZED);
  }

  // Step 5: Verify RankPill HMAC signature using action (runs in Node.js runtime)
  const verification = await ctx.runAction(internal.blogAuth.verifyRankPillSignature, {
    body,
    signature,
    secret: hmacSecret,
  });

  if (!verification.valid) {
    logger.error("Blog API auth failed", {
      error: verification.error,
      signatureLength: signature.length,
    });
    logWebhookEvent(logger, "blogApi", "failed", {
      reason: verification.error,
    });
    return errorResponse(
      `Authentication failed: ${verification.error}`,
      HTTP_STATUS_UNAUTHORIZED
    );
  }

  logger.debug("HMAC signature verification successful");

  // Step 6: Parse JSON body
  let payload: RankPillPayload | { operation: string; [key: string]: unknown };
  try {
    payload = JSON.parse(body);
  } catch (error) {
    logger.error("Failed to parse JSON body", error);
    return errorResponse("Invalid JSON body", HTTP_STATUS_BAD_REQUEST);
  }

  // Step 7: Handle RankPill format (article data without operation field)
  // RankPill sends: { title, content_html, ... } instead of { operation, ... }
  // Type guard: check if payload is RankPillPayload (has title and content_html, no operation)
  const isRankPillPayload = (p: typeof payload): p is RankPillPayload => {
    return "title" in p && "content_html" in p && !("operation" in p);
  };
  
  if (isRankPillPayload(payload)) {
    logger.info("Detected RankPill article format, creating draft for review");
    
    // Use RankPill's slug if provided, otherwise generate from title
    const slug = payload.slug || generateSlug(payload.title);
    
    // Generate preview token for draft access using cryptographically secure randomness
    // Use action to access Node.js crypto APIs (httpAction bundling doesn't support crypto directly)
    const previewToken = await ctx.runAction(internal.blogAuth.generatePreviewToken);

    // Convert content to markdown
    // Prioritize content_markdown if available, otherwise convert content_html to Markdown
    // using turndown. This ensures ReactMarkdown can properly render the content.
    const bodyMarkdown = payload.content_markdown || 
      (payload.content_html ? turndownService.turndown(payload.content_html) : "");
    
    // Extract metadata from RankPill payload
    const author = payload.author || "Sam He";
    const tags = normalizeTagsField(payload);
    // Use meta_description as excerpt if excerpt/description not provided
    const excerpt = payload.excerpt || payload.description || payload.meta_description || undefined;
    // Use published_url as canonicalUrl if canonical_url/canonicalUrl not provided
    const canonicalUrl = payload.canonical_url || payload.canonicalUrl || payload.published_url || undefined;
    
    // Convert published_at ISO string to timestamp if provided
    let publishedAt: number | undefined = undefined;
    if (payload.published_at) {
      try {
        publishedAt = new Date(payload.published_at).getTime();
        if (isNaN(publishedAt)) {
          logger.warn("Invalid published_at format, ignoring", { published_at: payload.published_at });
          publishedAt = undefined;
        }
      } catch (error) {
        logger.warn("Failed to parse published_at, ignoring", { published_at: payload.published_at });
      }
    }
    
    try {
      // Create draft with preview token and all RankPill metadata
      const { postId } = await ctx.runMutation(api.blog.createDraft, {
        title: payload.title,
        bodyMarkdown,
        excerpt,
        author,
        tags,
        readingTime: payload.reading_time || undefined,
        canonicalUrl,
        slug, // Use RankPill's slug
        featuredImage: payload.featured_image || undefined, // Store featured image
        publishedAt, // Store published_at timestamp
        draftPreviewToken: previewToken,
      });

      // Get frontend base URL for preview links (use SHARE_BASE_URL which is already configured for frontend)
      // SHARE_BASE_URL is set to http://localhost:5173 for local dev and production domain for prod
      const frontendBaseUrl = process.env.SHARE_BASE_URL || "http://localhost:5173";
      const previewUrl = `${frontendBaseUrl}/blog/preview/${previewToken}`;
      
      // Approve/dismiss URLs should use the backend URL since they're API endpoints
      // CONVEX_SITE_URL is provided automatically by Convex - fail fast if missing to prevent incorrect URLs
      const backendBaseUrl = process.env.CONVEX_SITE_URL;
      if (!backendBaseUrl) {
        logger.error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
        throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex). Cannot generate approve/dismiss URLs.");
      }
      const approveUrl = `${backendBaseUrl}${BLOG_DRAFT_APPROVE_PATH}?postId=${postId}&token=${previewToken}`;
      const dismissUrl = `${backendBaseUrl}${BLOG_DRAFT_DISMISS_PATH}?postId=${postId}&token=${previewToken}`;

      // Send Slack notification
      try {
        await ctx.runAction(internal.utils.slack.sendDraftReviewNotification, {
          postId,
          title: payload.title,
          previewUrl,
          approveUrl,
          dismissUrl,
          previewToken,
        });
        logger.info("Slack notification sent successfully");
      } catch (slackError) {
        // Log but don't fail the webhook if Slack notification fails
        logger.warn("Failed to send Slack notification", {
          error: slackError instanceof Error ? slackError.message : "Unknown error",
        });
      }

      logWebhookEvent(logger, "blogApi", "processed", {
        operation: "rankpillDraft",
        postId,
        previewToken,
      });
      
      return successResponse({ 
        success: true, 
        result: { 
          postId, 
          status: "draft",
          previewToken,
          previewUrl,
        } 
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create draft";
      logger.error("Failed to create RankPill draft", error, {
        title: payload.title,
        slug,
      });
      logWebhookEvent(logger, "blogApi", "failed", {
        operation: "rankpillDraft",
        error: errorMessage,
      });
      return errorResponse(
        errorMessage,
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
  }

  // Step 8: Handle standard API format with operation field
  // At this point, payload is not RankPillPayload, so it must have operation
  if (!("operation" in payload) || typeof payload.operation !== "string") {
    logger.warn("Payload missing operation field and is not RankPill format", {
      payloadKeys: Object.keys(payload),
    });
    return errorResponse(
      "Missing operation field. Expected operation field or RankPill article format.",
      HTTP_STATUS_BAD_REQUEST
    );
  }
  
  const { operation, ...params } = payload;

  // Add operation context to logger
  const operationLogger = logger.child({ operation });

  try {
    let result;

    switch (operation) {
      case "createDraft":
        result = await ctx.runMutation(api.blog.createDraft, params);
        break;

      case "updateDraft":
        result = await ctx.runMutation(api.blog.updateDraft, params);
        break;

      case "publish":
        result = await ctx.runMutation(api.blog.publish, params);
        break;

      case "archive":
        result = await ctx.runMutation(api.blog.archive, params);
        break;

      case "setRedirects":
        result = await ctx.runMutation(api.blog.setRedirects, params);
        break;

      default:
        operationLogger.warn("Unknown operation", { operation, payloadKeys: Object.keys(payload) });
        return errorResponse(`Unknown operation: ${operation || "missing"}. Expected operation field or RankPill article format.`, HTTP_STATUS_BAD_REQUEST);
    }

    logWebhookEvent(operationLogger, "blogApi", "processed", {
      operation,
      resultId: result?.id || result?._id || undefined,
    });
    return successResponse({ success: true, result });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    operationLogger.error("Blog API operation failed", error, {
      operation,
      params: Object.keys(params),
    });
    logWebhookEvent(operationLogger, "blogApi", "failed", {
      operation,
      error: errorMessage,
    });
    return errorResponse(
      errorMessage,
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});
