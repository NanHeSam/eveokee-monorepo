/**
 * Shared webhook utilities
 * Common helpers for HTTP request handling, validation, and responses
 */

import type { Id } from "../_generated/dataModel";
import {
  REVENUECAT_STORE_TO_PLATFORM,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "../utils/constants";
import {
  createLogger,
  generateCorrelationId,
  type Logger,
} from "../utils/logger";

/**
 * Standard JSON response headers
 */
export const jsonHeaders = {
  "Content-Type": "application/json",
} as const;

/**
 * Type guard to validate if a string is a valid Convex ID format.
 * Convex IDs are base64-encoded strings with a specific pattern.
 */
export function isValidConvexId(id: string): id is Id<"users"> {
  // Convex IDs are non-empty strings with alphanumeric characters, underscores, and hyphens
  // They typically follow a pattern but we'll do a basic validation
  return typeof id === "string" && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Map RevenueCat store names to our platform enum.
 * Only supports: Apple App Store, Google Play Store, and Stripe (web).
 * Returns undefined for unsupported platforms.
 */
export function getPlatformFromStore(
  store: string | undefined
): "app_store" | "play_store" | "stripe" | undefined {
  return store ? REVENUECAT_STORE_TO_PLATFORM[store] : undefined;
}

/**
 * Create a JSON error response
 */
export function errorResponse(
  message: string,
  status: number = 400 // Defaults to HTTP_STATUS_BAD_REQUEST, but allowing override for flexibility
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * Create a JSON success response
 */
export function successResponse(
  data: Record<string, unknown> = { status: "ok" },
  status: number = 200 // Defaults to HTTP_STATUS_OK, but allowing override for flexibility
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * Validate HTTP method and return error response if invalid
 * @param req - The incoming request
 * @param allowedMethod - The allowed HTTP method (typically "POST")
 * @returns Response if method is invalid, undefined if valid
 */
export function validateHttpMethod(
  req: Request,
  allowedMethod: string = "POST"
): Response | undefined {
  if (req.method !== allowedMethod) {
    return new Response("Method Not Allowed", {
      status: HTTP_STATUS_METHOD_NOT_ALLOWED,
    });
  }
  return undefined;
}

/**
 * Parse JSON body from request with error handling
 * @param req - The incoming request
 * @returns Parsed JSON object or undefined if parsing fails
 */
export async function parseJsonBody<T = unknown>(
  req: Request
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: Response }> {
  try {
    const data = (await req.json()) as T;
    return { data };
  } catch (error) {
    return {
      error: errorResponse(
        "Invalid JSON",
        HTTP_STATUS_BAD_REQUEST
      ),
    };
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param req - The incoming request
 * @returns The token string if present, undefined otherwise
 */
export function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Verify Bearer token authentication
 * @param req - The incoming request
 * @param expectedToken - The expected token from environment variables
 * @returns Response if authentication fails, undefined if successful
 */
export function verifyBearerToken(
  req: Request,
  expectedToken: string | undefined
): Response | undefined {
  if (!expectedToken) {
    return errorResponse("Server configuration error", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  const receivedToken = extractBearerToken(req);
  if (!receivedToken || receivedToken !== expectedToken) {
    return errorResponse("Unauthorized", HTTP_STATUS_UNAUTHORIZED);
  }

  return undefined;
}

/**
 * Create a webhook logger with correlation ID and handler name
 * @param handlerName - Name of the webhook handler function
 * @returns Logger instance with correlation ID and function name
 */
export function createWebhookLogger(handlerName: string): Logger {
  const correlationId = generateCorrelationId();
  return createLogger({
    functionName: handlerName,
    correlationId,
  });
}

