export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const CLERK_WEBHOOK_PATH = "/webhooks/clerk";
export const REVENUECAT_WEBHOOK_PATH = "/webhooks/revenuecat";
export const VAPI_WEBHOOK_PATH = "/webhooks/vapi";

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
