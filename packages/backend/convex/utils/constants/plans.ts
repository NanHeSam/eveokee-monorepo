/**
 * Subscription plan configuration
 * Defines subscription tiers and their limits
 */

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

