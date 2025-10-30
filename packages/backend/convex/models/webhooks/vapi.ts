/**
 * VAPI webhook payload types
 * Used for call event processing
 */

import { VAPI_SAMPLE_WEBHOOK_DURATION_SECONDS } from "../../utils/constants";

/**
 * Validation helpers for VAPI webhook events
 */

/**
 * Type guard to check if an object is a valid VapiWebhookEvent
 */
export function isValidVapiWebhookEvent(event: unknown): event is VapiWebhookEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }

  const e = event as Record<string, unknown>;

  // Check if message exists and is an object
  if (!e.message || typeof e.message !== "object" || Array.isArray(e.message)) {
    return false;
  }

  const message = e.message as Record<string, unknown>;

  // Check if message.type is a string
  if (typeof message.type !== "string") {
    return false;
  }

  return true;
}

/**
 * Extract and validate call ID from VAPI webhook event
 * @returns The call ID if valid, undefined otherwise
 */
export function extractVapiCallId(event: VapiWebhookEvent): string | undefined {
  return event.message.call?.id;
}

/**
 * Extract and parse endedAt timestamp from VAPI webhook event
 * @returns The parsed timestamp in milliseconds, or Date.now() as fallback
 */
export function extractEndedAt(event: VapiWebhookEvent): number {
  const endedAtValue = event.message.call?.endedAt;

  if (endedAtValue === undefined || endedAtValue === null) {
    return Date.now();
  }

  if (typeof endedAtValue === "number") {
    return endedAtValue;
  }

  if (typeof endedAtValue === "string") {
    const parsed = Date.parse(endedAtValue);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

/**
 * Extract and validate duration seconds from VAPI webhook event
 * @returns The duration in seconds if valid, undefined otherwise
 */
export function extractDurationSeconds(event: VapiWebhookEvent): number | undefined {
  const durationValue = event.message.durationSeconds;

  if (durationValue === undefined || durationValue === null) {
    return undefined;
  }

  if (typeof durationValue === "number" && !isNaN(durationValue) && isFinite(durationValue)) {
    return durationValue;
  }

  return undefined;
}

/**
 * Extract and validate disposition from VAPI webhook event
 * @returns The disposition string, or "completed" as default
 */
export function extractDisposition(event: VapiWebhookEvent): string {
  const dispositionValue = event.message.call?.disposition;

  if (dispositionValue !== undefined && dispositionValue !== null && typeof dispositionValue === "string") {
    return dispositionValue;
  }

  return "completed";
}

/**
 * Extract artifact data from VAPI webhook event
 * @returns The artifact object, or empty object if invalid
 */
export function extractArtifact(event: VapiWebhookEvent): Record<string, unknown> {
  const artifact = event.message.artifact;

  if (artifact !== undefined && artifact !== null && typeof artifact === "object" && !Array.isArray(artifact)) {
    return artifact as Record<string, unknown>;
  }

  return {};
}

export interface VapiWebhookEvent {
  message: {
    type: string;
    call?: {
      id: string;
      endedAt?: number | string;
      disposition?: string;
    };
    durationSeconds?: number;
    artifact?: {
      transcript?: string;
      messages?: unknown[];
      recording?: unknown;
    };
    endedReason?: string;
  };
}

/**
 * Validated VAPI end-of-call-report payload
 */
export interface VapiEndOfCallReport {
  vapiCallId: string;
  endedAt: number;
  durationSeconds?: number;
  disposition: string;
  transcript?: string;
  messages?: unknown[];
  recording?: unknown;
  endedReason?: string;
}

/**
 * Sample VAPI end-of-call-report event for testing
 */
export const sampleVapiEndOfCallReport: VapiWebhookEvent = {
  message: {
    type: "end-of-call-report",
    call: {
      id: "call_test123",
      endedAt: Date.now(),
      disposition: "completed",
    },
    durationSeconds: VAPI_SAMPLE_WEBHOOK_DURATION_SECONDS,
    artifact: {
      transcript: "Sample transcript text",
      messages: [],
    },
    endedReason: "hangup",
  },
};

