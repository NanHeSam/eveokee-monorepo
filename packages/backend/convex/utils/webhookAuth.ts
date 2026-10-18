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
