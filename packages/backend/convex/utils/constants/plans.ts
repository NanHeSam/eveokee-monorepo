/**
 * Subscription plan configuration
 * Defines subscription tiers and their limits
 */

export const PLAN_CONFIG = {
  free: {
    musicLimit: 5,
    periodDays: 30,
    price: 0,
  },
  weekly: {
    musicLimit: 20,
    periodDays: 7,
    price: 3.99,
  },
  monthly: {
    musicLimit: 90,
    periodDays: 30,
    price: 9.99,
  },
  yearly: {
    musicLimit: 1200,
    periodDays: 365,
    price: 99.99,
  },
} as const;

