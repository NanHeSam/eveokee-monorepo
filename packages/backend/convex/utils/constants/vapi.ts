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
export const VAPI_TRANSCRIBER_PROVIDER = "deepgram";

// Model Configuration
export const VAPI_MODEL_NAME = "gpt-4.1";
export const VAPI_MODEL_PROVIDER = "openai";

// Assistant Defaults
export const VAPI_ASSISTANT_NAME = "eveokee";

// Timeout Configuration
export const VAPI_DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

// Sample webhook data
export const VAPI_SAMPLE_WEBHOOK_DURATION_SECONDS = 300; // 5 minutes
