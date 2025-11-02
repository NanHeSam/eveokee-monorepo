/**
 * VAPI API integration constants
 * Configuration for VAPI voice AI service
 */

// API Endpoints
export const VAPI_API_BASE_URL = "https://api.vapi.ai";
export const VAPI_WEBHOOK_PATH = "/webhooks/vapi";

// Voice Configuration
export const DEFAULT_VOICE_ID = "d46abd1d-2d02-43e8-819f-51fb652c1c61";

// Transcriber Configuration
export const VAPI_TRANSCRIBER_MODEL = "nova-2";
export const VAPI_TRANSCRIBER_LANGUAGE = "en";
export const VAPI_TRANSCRIBER_PROVIDER = "deepgram";

// Model Configuration
export const VAPI_MODEL_NAME = "gpt-4.1";
export const VAPI_MODEL_PROVIDER = "openai";

// Voice Configuration
export const VAPI_VOICE_MODEL = "sonic-3";
export const VAPI_VOICE_PROVIDER = "cartesia";

// Assistant Defaults
export const VAPI_ASSISTANT_NAME = "eveokee";
export const VAPI_FIRST_MESSAGE_MODE = "assistant-speaks-first-with-model-generated-message";
export const VAPI_VOICEMAIL_MESSAGE = "Please call back when you're available.";
export const VAPI_END_CALL_MESSAGE = "Goodbye.";
export const VAPI_USER_NAME_FALLBACK = "there";

// Timeout Configuration
export const VAPI_DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

// Sample webhook data
export const VAPI_SAMPLE_WEBHOOK_DURATION_SECONDS = 300; // 5 minutes

// Tool Configuration
export const HANGUP_TOOL_ID = "639ef417-c953-4f52-b256-2aee87a72452";