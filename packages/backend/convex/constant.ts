export const MUSIC_GENERATION_CALLBACK_PATH = "/callback/suno-music-generation";
export const CLERK_WEBHOOK_PATH = "/webhooks/clerk";
export const REVENUECAT_WEBHOOK_PATH = "/webhooks/revenuecat";

export const PLAN_CONFIG = {
    alpha: {
      musicLimit: 3,
      periodDays: null,
      price: 0,
      hasUnlimited: false,
      description: "Legacy alpha access",
    },
    free: {
      musicLimit: 7,
      periodDays: 30,
      price: 0,
      hasUnlimited: false,
      description: "Free plan with limited generations",
    },
    weekly: {
      musicLimit: 25,
      periodDays: 7,
      price: 3.99,
      hasUnlimited: false,
      description: "Weekly access with expanded quota",
    },
    monthly: {
      musicLimit: 90,
      periodDays: 30,
      price: 9.99,
      hasUnlimited: false,
      description: "Monthly Unlimited",
    },
    yearly: {
      musicLimit: 1000,
      periodDays: 365,
      price: 99.99,
      hasUnlimited: false,
      description: "Yearly Unlimited",
    },
  } as const;
