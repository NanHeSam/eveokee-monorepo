"use node";

/**
 * Blog API authentication utilities
 * Uses Node.js crypto APIs for HMAC verification
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { createHmac, timingSafeEqual } from "crypto";

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Verify HMAC signature with timestamp validation
 * Used for timestamp-based HMAC verification (timestamp.body format)
 */
export const verifyHmacSignature = action({
  args: {
    body: v.string(),
    timestamp: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { body, timestamp, signature, secret } = args;

    // Check timestamp is not too old (10 min skew)
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
      return { valid: false, error: "timestamp invalid format" };
    }

    const now = Date.now();
    const age = now - requestTime;

    if (age > TEN_MINUTES_MS) {
      return { valid: false, error: "timestamp too old" };
    }

    if (age < -TEN_MINUTES_MS) {
      return { valid: false, error: "timestamp too far in future" };
    }

    // Compute HMAC over timestamp + body
    const payload = `${timestamp}.${body}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Timing-safe comparison
    try {
      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (signatureBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: "signature invalid" };
      }

      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, error: "signature invalid" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "signature invalid" };
    }
  },
});

/**
 * Verify RankPill webhook HMAC signature
 * RankPill signs just the request body (no timestamp)
 * Signature is provided in x-rankpill-signature header or authorization header (sha256=...)
 */
export const verifyRankPillSignature = action({
  args: {
    body: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { body, signature, secret } = args;

    // Compute HMAC over body only (RankPill format)
    const expectedSignature = createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    // Timing-safe comparison
    try {
      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (signatureBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: "signature length mismatch" };
      }

      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, error: "signature mismatch" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `signature verification failed: ${error instanceof Error ? error.message : "unknown error"}` };
    }
  },
});

