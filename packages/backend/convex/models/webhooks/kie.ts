/**
 * Kie.ai API webhook payload types and validators
 * Used for video generation callback processing
 */

import { HTTP_STATUS_OK } from "../../utils/constants";

/**
 * Kie video data structure
 * Based on Kie.ai API documentation
 */
export interface KieVideoData {
  taskId?: string;
  videoUrl?: string;
  duration?: number;
  status?: string;
  model?: string;
  aspectRatio?: string;
  nFrames?: string;
  prompt?: string;
}

/**
 * Kie callback data structure
 */
export interface KieCallbackData {
  callbackType?: string;
  type?: string;
  taskId?: string;
  task_id?: string;
  data?: KieVideoData;
  video?: KieVideoData;
  videoUrl?: string;
  status?: string;
  resultJson?: string; // JSON string containing resultUrls array
  state?: string;
}

/**
 * Raw Kie webhook payload (unvalidated)
 */
export interface KieWebhookPayload {
  code?: number;
  msg?: string;
  message?: string;
  data?: KieCallbackData;
  taskId?: string;
  videoUrl?: string;
  status?: string;
}

/**
 * Validated Kie callback payload structure
 */
export interface KieCallbackPayload {
  code: number;
  callbackType: string;
  taskId: string;
  videoUrl: string;
  videoData?: KieVideoData;
}

/**
 * Validation helpers for Kie webhook callbacks
 */

/**
 * Type guard to validate Kie video data structure
 */
function isValidKieVideoData(video: unknown): video is KieVideoData {
  if (!video || typeof video !== "object" || Array.isArray(video)) {
    return false;
  }
  // Basic structure check - at minimum should have some data
  return true;
}

/**
 * Type guard to check if a value is a valid KieWebhookPayload structure
 */
export function isValidKieCallback(body: unknown): body is KieWebhookPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const b = body as Record<string, unknown>;
  
  // Should have either data structure or direct fields
  if (b.data) {
    if (typeof b.data !== "object" || Array.isArray(b.data)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract and validate taskId from Kie callback
 * @returns The taskId if valid, undefined otherwise
 */
export function extractKieTaskId(body: KieWebhookPayload): string | undefined {
  // Try multiple possible locations for taskId
  const taskId = 
    body.taskId ?? 
    body.data?.taskId ?? 
    body.data?.task_id ?? 
    body.data?.data?.taskId;
  
  return typeof taskId === "string" ? taskId : undefined;
}

/**
 * Extract and validate video URL from Kie callback
 * @returns The video URL if valid, undefined otherwise
 */
export function extractKieVideoUrl(body: KieWebhookPayload): string | undefined {
  // First, try to extract from resultJson if it exists
  if (body.data?.resultJson) {
    try {
      const resultJson = JSON.parse(body.data.resultJson);
      if (resultJson?.resultUrls && Array.isArray(resultJson.resultUrls) && resultJson.resultUrls.length > 0) {
        const url = resultJson.resultUrls[0];
        if (typeof url === "string") {
          return url;
        }
      }
    } catch (error) {
      // If parsing fails, fall through to other extraction methods
    }
  }
  
  // Try multiple possible locations for videoUrl
  const videoUrl = 
    body.videoUrl ?? 
    body.data?.videoUrl ?? 
    body.data?.video?.videoUrl ?? 
    body.data?.data?.videoUrl;
  
  return typeof videoUrl === "string" ? videoUrl : undefined;
}

/**
 * Extract callback type from Kie callback
 * @returns The callback type string, defaults to "complete"
 */
export function extractKieCallbackType(body: KieWebhookPayload): string {
  const callbackType = 
    body.data?.callbackType ?? 
    body.data?.type ?? 
    body.data?.status ?? 
    body.data?.state ?? 
    body.status;
  
  // Map "success" state to "complete" for consistency
  if (callbackType === "success") {
    return "complete";
  }
  
  // Default to "complete" for successful callbacks
  return typeof callbackType === "string" ? callbackType : "complete";
}

/**
 * Extract video data from Kie callback
 * @returns Video data object or undefined
 */
export function extractKieVideoData(body: KieWebhookPayload): KieVideoData | undefined {
  const videoData = body.data?.data ?? body.data?.video ?? body.data;
  
  if (videoData && isValidKieVideoData(videoData)) {
    return videoData as KieVideoData;
  }
  
  return undefined;
}

/**
 * Parse and validate Kie webhook payload
 * @returns Validated payload or error message
 */
export function parseKiePayload(
  body: unknown
): { success: true; data: KieCallbackPayload } | { success: false; error: string } {
  if (!isValidKieCallback(body)) {
    return { success: false, error: "Invalid payload structure" };
  }

  const taskId = extractKieTaskId(body);
  if (!taskId) {
    return { success: false, error: "Missing taskId" };
  }

  const videoUrl = extractKieVideoUrl(body);
  if (!videoUrl) {
    return { success: false, error: "Missing videoUrl" };
  }

  const callbackType = extractKieCallbackType(body);
  const code = typeof body.code === "number" ? body.code : HTTP_STATUS_OK;
  const videoData = extractKieVideoData(body);

  return {
    success: true,
    data: {
      code,
      callbackType,
      taskId,
      videoUrl,
      videoData,
    },
  };
}

/**
 * Sample Kie callback payload for testing
 */
export const sampleKieCallback: KieWebhookPayload = {
  code: HTTP_STATUS_OK,
  msg: "success",
  data: {
    callbackType: "complete",
    taskId: "test-task-id",
    data: {
      taskId: "test-task-id",
      videoUrl: "https://example.com/video.mp4",
      duration: 15,
      status: "completed",
      model: "sora-2-text-to-video",
      aspectRatio: "portrait",
      nFrames: "15",
    },
  },
};


