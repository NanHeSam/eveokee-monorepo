/**
 * Suno API webhook payload types and validators
 * Used for music generation callback processing
 */

import { HTTP_STATUS_OK, SUNO_SAMPLE_WEBHOOK_DURATION_SECONDS } from "../../utils/constants";

/**
 * Suno track data structure
 * Based on fixtures: only fields we actually use
 */
export interface SunoTrack {
  id: string;
  title?: string;
  duration?: number;
  prompt?: string;
  tags?: string;
  audio_url?: string;
  image_url?: string;
  source_audio_url?: string;
  source_image_url?: string;
  source_stream_audio_url?: string;
  stream_audio_url?: string;
  model_name?: string;
  createTime?: number;
}

/**
 * Suno callback data structure
 */
export interface SunoCallbackData {
  callbackType: string;
  task_id?: string;
  taskId?: string;
  data?: SunoTrack[];
}

/**
 * Raw Suno webhook payload (unvalidated)
 */
export interface SunoWebhookPayload {
  code?: number;
  msg?: string;
  data?: SunoCallbackData;
}

/**
 * Validated Suno callback payload structure
 */
export interface SunoCallbackPayload {
  code: number;
  callbackType: string;
  taskId: string;
  tracks: SunoTrack[];
}

/**
 * Validation helpers for Suno webhook callbacks
 */

/**
 * Type guard to validate Suno track structure
 */
function isValidSunoTrack(track: unknown): track is SunoTrack {
  if (!track || typeof track !== "object" || Array.isArray(track)) {
    return false;
  }
  const t = track as Record<string, unknown>;
  // Only require id field
  return typeof t.id === "string";
}

/**
 * Type guard to check if a value is a valid SunoWebhookPayload structure
 */
export function isValidSunoCallback(body: unknown): body is SunoWebhookPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const b = body as Record<string, unknown>;
  
  // Validate data structure if present
  if (b.data) {
    if (typeof b.data !== "object" || Array.isArray(b.data)) {
      return false;
    }
    const data = b.data as Record<string, unknown>;
    
    // Validate callbackType if present
    if (data.callbackType !== undefined && typeof data.callbackType !== "string") {
      return false;
    }
    
    // Validate tracks array if present
    if (data.data !== undefined) {
      if (!Array.isArray(data.data)) {
        return false;
      }
      // Validate each track has at least an id
      for (const track of data.data) {
        if (!isValidSunoTrack(track)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Extract and validate taskId from Suno callback
 * @returns The taskId if valid, undefined otherwise
 */
export function extractSunoTaskId(body: SunoWebhookPayload): string | undefined {
  const taskIdValue = body.data?.task_id ?? body.data?.taskId;
  return typeof taskIdValue === "string" ? taskIdValue : undefined;
}

/**
 * Extract and validate tracks from Suno callback
 * @returns Array of validated track objects, or empty array if invalid
 */
export function extractSunoTracks(body: SunoWebhookPayload): SunoTrack[] {
  const tracksRaw = body.data?.data;
  if (!Array.isArray(tracksRaw)) {
    return [];
  }
  // Filter to only tracks that pass validation
  return tracksRaw.filter(isValidSunoTrack);
}

/**
 * Extract callback type from Suno callback
 * @returns The callback type string, or undefined if not present
 */
export function extractSunoCallbackType(body: SunoWebhookPayload): string | undefined {
  const callbackType = body.data?.callbackType;
  return typeof callbackType === "string" ? callbackType : undefined;
}

/**
 * Parse and validate Suno webhook payload
 * @returns Validated payload or error message
 */
export function parseSunoPayload(
  body: unknown
): { success: true; data: SunoCallbackPayload } | { success: false; error: string } {
  if (!isValidSunoCallback(body)) {
    return { success: false, error: "Invalid payload structure" };
  }

  const taskId = extractSunoTaskId(body);
  if (!taskId) {
    return { success: false, error: "Missing taskId" };
  }

  const callbackType = extractSunoCallbackType(body);
  if (!callbackType) {
    return { success: false, error: "Missing callbackType" };
  }

  const code = typeof body.code === "number" ? body.code : HTTP_STATUS_OK;
  const tracks = extractSunoTracks(body);

  return {
    success: true,
    data: {
      code,
      callbackType,
      taskId,
      tracks,
    },
  };
}

/**
 * Sample Suno callback payload for testing
 */
export const sampleSunoCallback: SunoWebhookPayload = {
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

