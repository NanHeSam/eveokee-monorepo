/**
 * Suno API webhook payload types and validators
 * Used for music generation callback processing
 */

import { HTTP_STATUS_OK, SUNO_SAMPLE_WEBHOOK_DURATION_SECONDS } from "../../utils/constants";

export type RawSunoCallback = {
  code?: unknown;
  msg?: unknown;
  data?: {
    callbackType?: unknown;
    task_id?: unknown;
    taskId?: unknown;
    data?: unknown;
  };
};

/**
 * Validated Suno callback payload structure
 */
export interface SunoCallbackPayload {
  code: number;
  callbackType: string;
  taskId: string;
  tracks: Array<Record<string, unknown>>;
}

/**
 * Validation helpers for Suno webhook callbacks
 */

/**
 * Type guard to check if a value is a valid RawSunoCallback structure
 */
export function isValidSunoCallback(body: unknown): body is RawSunoCallback {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  return true;
}

/**
 * Extract and validate taskId from Suno callback
 * @returns The taskId if valid, undefined otherwise
 */
export function extractSunoTaskId(body: RawSunoCallback): string | undefined {
  const taskIdValue = body.data?.task_id ?? body.data?.taskId;
  return typeof taskIdValue === "string" ? taskIdValue : undefined;
}

/**
 * Extract and validate tracks from Suno callback
 * @returns Array of track objects, or empty array if invalid
 */
export function extractSunoTracks(body: RawSunoCallback): Array<Record<string, unknown>> {
  const tracksRaw = body.data?.data;
  return Array.isArray(tracksRaw) ? tracksRaw : [];
}

/**
 * Extract callback type from Suno callback
 * @returns The callback type string, or undefined if not present
 */
export function extractSunoCallbackType(body: RawSunoCallback): string | undefined {
  const callbackType = body.data?.callbackType;
  return typeof callbackType === "string" ? callbackType : undefined;
}

/**
 * Sample Suno callback payload for testing
 */
export const sampleSunoCallback: RawSunoCallback = {
  code: HTTP_STATUS_OK,
  msg: "success",
  data: {
    callbackType: "complete",
    taskId: "test-task-id",
    data: [
      {
        id: "test-track-id",
        audio_url: "https://example.com/audio.mp3",
        title: "Test Track",
        duration: SUNO_SAMPLE_WEBHOOK_DURATION_SECONDS,
      },
    ],
  },
};

