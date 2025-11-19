/**
 * Music generation constants
 * Configuration for Suno API and OpenAI music generation
 */

// Suno API
export const SUNO_API_GENERATE_ENDPOINT = "https://api.sunoapi.org/api/v1/generate";
export const SUNO_API_TIMESTAMPED_LYRICS_ENDPOINT = "https://api.sunoapi.org/api/v1/generate/get-timestamped-lyrics";
export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const SUNO_SONGS_PER_REQUEST = 2;
export const SUNO_DEFAULT_MODEL = "V5" as const;

// OpenAI Configuration for Music Generation
export const OPENAI_LYRIC_GENERATION_MODEL = "gpt-4.1-2025-04-14";
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

/**
 * Music style descriptors for random selection
 * These are combined with AI-generated mood to create the final style
 * Shared between backend and frontend
 */
export const MUSIC_STYLE_DESCRIPTORS = [
  // Rock variations
  "alternative rock",
  "folk rock",
  "punk rock",
  "post-rock",
  "shoegaze",
  "hard rock",
  "garage rock",
  "psychedelic rock",
  // Pop variations
  "synthpop",
  "electropop",
  "dream pop",
  "baroque pop",
  "art pop",
  "jangle pop",
  "bubblegum pop",
  "power pop",
  // Electronic
  "ambient",
  "house",
  "techno",
  "drum and bass",
  "trance",
  "chillwave",
  "lo-fi",
  "dubstep",
  "EDM",
  // Hip-hop/R&B
  "trap",
  "boom bap",
  "neo-soul",
  "contemporary R&B",
  "trip-hop",
  "drill",
  "cloud rap",
  // Jazz/Blues
  "smooth jazz",
  "bebop",
  "blues rock",
  "soul",
  "funk",
  "acid jazz",
  "fusion",
  // Country/Folk
  "Americana",
  "bluegrass",
  "country pop",
  "folk",
  "singer-songwriter",
  "alt-country",
  // World/International
  "Latin",
  "reggae",
  "afrobeat",
  "bossa nova",
  "flamenco",
  "samba",
  "salsa",
  // Classical/Orchestral
  "cinematic",
  "orchestral pop",
  "chamber music",
  "neoclassical",
  // Experimental
  "avant-garde",
  "noise",
  "glitch",
  "ambient experimental",
  "industrial",
] as const;

