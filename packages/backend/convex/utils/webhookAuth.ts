/**
 * Pure helpers for authenticating provider callbacks (kept free of Convex
 * imports so they are trivially unit-testable).
 *
 * Providers that cannot sign their callbacks (sunoapi.org) are authenticated
 * with a secret token we append to the callback URL we hand them. Kie.ai can
 * additionally sign callbacks with an HMAC key configured in its dashboard.
 */

/** Query parameter carrying the shared secret on callback URLs we generate. */
export const WEBHOOK_TOKEN_QUERY_PARAM = "token";

/**
 * Compare two strings without short-circuiting on the first differing
 * character, so response timing does not reveal how much of a secret matched.
 * Runs over the longer input; only the length itself is observable.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/** Append the webhook secret to a callback URL as a query parameter. */
export function appendWebhookToken(callbackUrl: string, secret: string): string {
  const url = new URL(callbackUrl);
  url.searchParams.set(WEBHOOK_TOKEN_QUERY_PARAM, secret);
  return url.toString();
}

/** Read the webhook token from a request URL, if present. */
export function extractWebhookToken(requestUrl: string): string | undefined {
  try {
    return new URL(requestUrl).searchParams.get(WEBHOOK_TOKEN_QUERY_PARAM) ?? undefined;
  } catch {
    return undefined;
  }
}

/** True when the request URL carries the expected webhook token. */
export function hasValidWebhookToken(requestUrl: string, expectedSecret: string): boolean {
  const received = extractWebhookToken(requestUrl);
  if (!received) return false;
  return timingSafeEqualString(received, expectedSecret);
}

/** Kie.ai signature headers (see https://docs.kie.ai/common-api/webhook-verification). */
export const KIE_WEBHOOK_TIMESTAMP_HEADER = "X-Webhook-Timestamp";
export const KIE_WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature";

/**
 * How old a signed Kie callback may be. Kie's signature covers only
 * `taskId.timestamp`, not the body, so freshness plus the pending-task check
 * is what bounds replays.
 */
export const KIE_WEBHOOK_MAX_AGE_SECONDS = 15 * 60;
/** Tolerated clock skew for timestamps slightly in the future. */
export const KIE_WEBHOOK_MAX_FUTURE_SKEW_SECONDS = 5 * 60;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** base64(HMAC-SHA256(`${taskId}.${timestamp}`, key)), as Kie computes it. */
export async function computeKieWebhookSignature(
  taskId: string,
  timestampSeconds: string,
  hmacKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${taskId}.${timestampSeconds}`));
  return bytesToBase64(new Uint8Array(signature));
}

export type KieSignatureCheck =
  | { valid: true }
  | { valid: false; reason: "missing_headers" | "bad_timestamp" | "stale_timestamp" | "bad_signature" };

/** Verify Kie's X-Webhook-Timestamp / X-Webhook-Signature headers for a task. */
export async function verifyKieWebhookSignature(params: {
  taskId: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  hmacKey: string;
  nowMs?: number;
}): Promise<KieSignatureCheck> {
  const { taskId, timestamp, signature, hmacKey } = params;
  if (!timestamp || !signature) {
    return { valid: false, reason: "missing_headers" };
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    return { valid: false, reason: "bad_timestamp" };
  }
  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const age = nowSeconds - Number(timestamp);
  if (age > KIE_WEBHOOK_MAX_AGE_SECONDS || age < -KIE_WEBHOOK_MAX_FUTURE_SKEW_SECONDS) {
    return { valid: false, reason: "stale_timestamp" };
  }
  const expected = await computeKieWebhookSignature(taskId, timestamp, hmacKey);
  if (!timingSafeEqualString(signature, expected)) {
    return { valid: false, reason: "bad_signature" };
  }
  return { valid: true };
}
