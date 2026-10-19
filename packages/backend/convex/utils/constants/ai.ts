/**
 * AI model selection (verified 2026-10-18 in the Gateway catalog)
 * Every LLM call goes through the Vercel AI Gateway, so a model is just a
 * "provider/model" string. Change models here; IDs must exist in the gateway
 * catalog (https://ai-gateway.vercel.sh/v1/models).
 */

// Creative generation (vision-capable: the video prompt reads the diary photo)
export const AI_MODEL_LYRICS = "anthropic/claude-sonnet-5.5";
export const AI_MODEL_VIDEO_SCRIPT = "anthropic/claude-sonnet-5.5";

// Lightweight extraction / summarisation
export const AI_MODEL_DIARY_FROM_TRANSCRIPT = "anthropic/claude-haiku-5.5";
export const AI_MODEL_BLOG_TAGS = "anthropic/claude-haiku-5.5";
export const AI_MODEL_MEMORY_EXTRACTION = "anthropic/claude-haiku-5.5";
export const AI_MODEL_RELATIONSHIP_HIGHLIGHT = "anthropic/claude-haiku-5.5";

// Fallback when AIClient.getModel() is called without a model
export const AI_GATEWAY_DEFAULT_MODEL = AI_MODEL_DIARY_FROM_TRANSCRIPT;

// Vapi uses native provider IDs, not Gateway IDs. Verified in Vapi OpenAI docs.
export const VAPI_MODEL_NAME = "gpt-5.4-mini";

// Output budgets (Sonnet thinking also counts toward the limit).
// Callers use low reasoning for Sonnet, and no reasoning for Haiku extraction.
export const AI_LYRICS_MAX_OUTPUT_TOKENS = 4096;
export const AI_DIARY_MAX_OUTPUT_TOKENS = 600;
export const AI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS = 10000;
export const AI_BLOG_TAGS_MAX_OUTPUT_TOKENS = 200;

// Per-call timeout (override with AI_GATEWAY_TIMEOUT, in ms)
export const AI_DEFAULT_TIMEOUT_MS = 60_000;
