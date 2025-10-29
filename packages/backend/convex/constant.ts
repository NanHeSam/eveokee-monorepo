export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const CLERK_WEBHOOK_PATH = "/webhooks/clerk";
export const REVENUECAT_WEBHOOK_PATH = "/webhooks/revenuecat";
export const VAPI_WEBHOOK_PATH = "/webhooks/vapi";

// VAPI voice configuration
export const DEFAULT_VOICE_ID = "d46abd1d-2d02-43e8-819f-51fb652c1c61";

export const PLAN_CONFIG = {
    free: {
      musicLimit: 10,
      periodDays: 30,
      price: 0,
    },
    monthly: {
      musicLimit: 90,
      periodDays: 30,
      price: 9.99,
    },
    yearly: {
      musicLimit: 1000,
      periodDays: 365,
      price: 99.99,
    },
  } as const;
