/**
 * Video generation constants
 * Configuration for Kie.ai API and video generation
 */

// Kie.ai API
export const KIE_API_CREATE_TASK_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
export const VIDEO_GENERATION_CALLBACK_PATH = "/callback/kie-video-generation";
export const KIE_MODEL_TEXT_TO_VIDEO = "sora-2-text-to-video" as const;

// Video generation settings
export const VIDEO_GENERATION_CREDIT_COST = 3; // Each video costs 3 credits
export const DEFAULT_VIDEO_DURATION = "15" as const; // 15 seconds
export const DEFAULT_ASPECT_RATIO = "portrait" as const; // Portrait for mobile-first
export const DEFAULT_REMOVE_WATERMARK = true;

// OpenAI Configuration for Video Script Generation
export const OPENAI_VIDEO_SCRIPT_MODEL = "gpt-5-mini";
export const OPENAI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS = 10000;

// Video limits
export const MAX_VIDEO_DURATION_SECONDS = 15;


