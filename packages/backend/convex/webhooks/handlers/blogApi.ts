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
import { generateSlug } from "../../utils/blogHelpers";

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
    bodyPreview: body.substring(0, 200), // First 200 chars for debugging
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
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    logger.error("Failed to parse JSON body", error);
    return errorResponse("Invalid JSON body", HTTP_STATUS_BAD_REQUEST);
  }

  // Step 7: Handle RankPill format (article data without operation field)
  // RankPill sends: { title, content_html, ... } instead of { operation, ... }
  if (payload.title && payload.content_html && !payload.operation) {
    logger.info("Detected RankPill article format, creating draft for review");
    
    // Generate slug from title (for when it gets approved)
    const slug = generateSlug(payload.title);
    
    // Generate preview token for draft access
    // NOTE: Using Math.random() instead of crypto.randomUUID() because Convex runtime
    // may not have access to Node.js crypto module. While Math.random() provides ~53 bits
    // of entropy (less than cryptographically secure), preview tokens are:
    // 1. Temporary (only used until draft is approved/dismissed)
    // 2. Low-risk (worst case: unauthorized preview of unpublished blog draft)
    // 3. Single-use (token is invalidated after approval/dismissal)
    // For higher security needs, consider using Convex's built-in ID generation or
    // implementing a cryptographically secure random generator if available in runtime.
    const generatePreviewToken = (): string => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let token = "";
      for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    const previewToken = generatePreviewToken();

    // Convert content to markdown
    // NOTE: If RankPill sends content_html instead of content_markdown, the HTML will be
    // passed through as-is. ReactMarkdown (used in the frontend) will render some HTML tags,
    // but may escape others. For proper HTML rendering, the frontend would need rehypeRaw plugin
    // with sanitization. Currently prioritizing content_markdown if available.
    // TODO: Consider adding HTML-to-Markdown conversion library (e.g., turndown) if RankPill
    // consistently sends HTML instead of Markdown.
    const bodyMarkdown = payload.content_markdown || payload.content_html || "";
    
    // Extract metadata from RankPill payload
    const author = payload.author || "Sam He";
    // Ensure tags is always an array
    let tags: string[] = [];
    if (Array.isArray(payload.tags)) {
      tags = payload.tags;
    } else if (Array.isArray(payload.tag)) {
      tags = payload.tag;
    } else if (payload.tags && typeof payload.tags === "string") {
      tags = [payload.tags];
    } else if (payload.tag && typeof payload.tag === "string") {
      tags = [payload.tag];
    }
    const excerpt = payload.excerpt || payload.description || undefined;
    const canonicalUrl = payload.canonical_url || payload.canonicalUrl || undefined;
    
    try {
      // Create draft with preview token
      const { postId } = await ctx.runMutation(api.blog.createDraft, {
        title: payload.title,
        bodyMarkdown,
        excerpt,
        author,
        tags,
        readingTime: payload.reading_time || undefined,
        canonicalUrl,
        draftPreviewToken: previewToken,
      });

      // Get frontend base URL for preview links (use SHARE_BASE_URL which is already configured for frontend)
      // SHARE_BASE_URL is set to http://localhost:5173 for local dev and production domain for prod
      const frontendBaseUrl = process.env.SHARE_BASE_URL || "http://localhost:5173";
      const previewUrl = `${frontendBaseUrl}/blog/preview/${previewToken}`;
      
      // Approve/dismiss URLs should use the backend URL since they're API endpoints
      const backendBaseUrl = process.env.CONVEX_SITE_URL || "https://eveokee.com";
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
      logger.error("Failed to create RankPill draft", error, {
        title: payload.title,
        slug,
      });
      logWebhookEvent(logger, "blogApi", "failed", {
        operation: "rankpillDraft",
        error: error.message || "Failed to create draft",
      });
      return errorResponse(
        error.message || "Failed to create draft",
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
  }

  // Step 8: Handle standard API format with operation field
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
    operationLogger.error("Blog API operation failed", error, {
      operation,
      params: Object.keys(params),
    });
    logWebhookEvent(operationLogger, "blogApi", "failed", {
      operation,
      error: error.message || "Operation failed",
    });
    return errorResponse(
      error.message || "Operation failed",
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});
