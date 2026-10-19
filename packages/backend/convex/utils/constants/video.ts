/**
 * Video generation constants
 * Configuration for Kie.ai API and video generation
 */

// Kie.ai API
export const KIE_API_CREATE_TASK_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
export const VIDEO_GENERATION_CALLBACK_PATH = "/callback/kie-video-generation";
export const KIE_MODEL_TEXT_TO_VIDEO = "bytedance/seedance-2-fast" as const;
export const KIE_MODEL_IMAGE_TO_VIDEO = KIE_MODEL_TEXT_TO_VIDEO;

// Video generation settings
export const VIDEO_GENERATION_CREDIT_COST = 3; // Each video costs 3 credits
export const DEFAULT_VIDEO_DURATION = "10" as const; // 10 seconds
export const DEFAULT_VIDEO_RESOLUTION = "720p" as const; // 720p resolution
export const DEFAULT_ASPECT_RATIO = "portrait" as const; // Portrait for mobile-first
export const DEFAULT_REMOVE_WATERMARK = true;

// Legacy names retained for callers; all LLM selections live in ai.ts.
export {
  AI_MODEL_VIDEO_SCRIPT as OPENAI_VIDEO_SCRIPT_MODEL,
  AI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS as OPENAI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS,
} from "./ai";

// Video limits
export const MAX_VIDEO_DURATION_SECONDS = 10;

// Bounds for downloading the finished video from the provider callback URL
export const VIDEO_DOWNLOAD_MAX_BYTES = 150 * 1024 * 1024; // a 10s 720p clip is well under this
export const VIDEO_DOWNLOAD_TIMEOUT_MS = 60_000;


