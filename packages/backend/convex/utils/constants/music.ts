/**
 * Music generation constants
 * Configuration for Suno API and OpenAI music generation
 */

// Suno API
export const SUNO_API_GENERATE_ENDPOINT = "https://api.sunoapi.org/api/v1/generate";
export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const SUNO_SONGS_PER_REQUEST = 2;
export const SUNO_DEFAULT_MODEL = "V5" as const;

// OpenAI Configuration for Music Generation
export const OPENAI_MUSIC_MODEL = "gpt-4.1-2025-04-14";
export const OPENAI_MUSIC_MAX_COMPLETION_TOKENS = 1000;

// OpenAI Configuration for Diary Generation
export const OPENAI_DIARY_MODEL = "gpt-4o-mini";
export const OPENAI_DIARY_MAX_COMPLETION_TOKENS = 600;

// Transcript Processing
export const MAX_TRANSCRIPT_LENGTH = 12000;

// Sample webhook data
export const SUNO_SAMPLE_WEBHOOK_DURATION_SECONDS = 120; // 2 minutes

// Music index sorting fallback
export const MAX_SAFE_MUSIC_INDEX = 9007199254740991;

