/**
 * Music generation constants
 * Configuration for Kie Suno and AI Gateway music generation
 */

// Suno music through Kie's unified jobs API.
export const KIE_MUSIC_MODEL = "ai-music-api/generate";
export const KIE_TIMESTAMPED_LYRICS_MODEL = "ai-music-api/timeStamped-lyrics";
export const KIE_API_RECORD_INFO_ENDPOINT = "https://api.kie.ai/api/v1/jobs/recordInfo";
export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const SUNO_SONGS_PER_REQUEST = 2;
export const SUNO_DEFAULT_MODEL = "V6" as const;

// V6 defaults to 20s; explicitly request a full diary song (valid range 10–360s).
export const SUNO_DEFAULT_DURATION_SECONDS = 120;

// Legacy names retained for callers; all LLM selections live in ai.ts.
export {
  AI_MODEL_LYRICS as OPENAI_LYRIC_GENERATION_MODEL,
  AI_LYRICS_MAX_OUTPUT_TOKENS as OPENAI_MUSIC_MAX_COMPLETION_TOKENS,
  AI_MODEL_DIARY_FROM_TRANSCRIPT as OPENAI_DIARY_MODEL,
  AI_DIARY_MAX_OUTPUT_TOKENS as OPENAI_DIARY_MAX_COMPLETION_TOKENS,
} from "./ai";

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

