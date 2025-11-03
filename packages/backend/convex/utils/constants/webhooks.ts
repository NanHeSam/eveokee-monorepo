/**
 * Webhook paths and HTTP constants
 * Shared constants for webhook handling and HTTP responses
 */

// Webhook Paths
export const CLERK_WEBHOOK_PATH = "/webhooks/clerk";
export const VAPI_ASSISTANT_REQUEST_PATH = "/webhooks/vapi/assistant-request";

// HTTP Status Codes
export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_UNAUTHORIZED = 401;
export const HTTP_STATUS_NOT_FOUND = 404;
export const HTTP_STATUS_METHOD_NOT_ALLOWED = 405;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

