# Billing & Usage Tracking Design Document

## Overview

This document outlines the implementation of subscription billing and usage tracking for Dairy Vibes, enabling tiered access to music generation features based on user subscription status.

## Architecture Decisions

### Database Design
- **Minimal table approach**: Use `users`, `subscriptionStatuses`, and existing `music`/`diaries` tables
- **Counter-based tracking**: Store usage counters directly in `subscriptionStatuses` table
- **Lazy period rollover**: Compute period end from `lastResetAt + planDuration` instead of storing explicit end dates
- **No historical tracking**: Counters reset each period; historical data inferred from existing music/diary records

### Subscription Management
- **Apple IAP integration**: Use `react-native-iap` for purchase flow
- **Server-side verification**: Verify receipts via Convex actions calling Apple's verification endpoints
- **Real-time sync**: Use App Store Server Notifications for subscription lifecycle events
- **Frontend gating**: Block features client-side based on backend status

## Data Models

### Users Table (Extended)
```typescript
interface User {
  clerkId: string;
  email?: string;
  name?: string;
  activeSubscriptionId?: Id<"subscriptionStatuses">;
  createdAt: number;
  updatedAt: number;
}
```

### Subscription Statuses Table
```typescript
interface SubscriptionStatus {
  userId: Id<"users">;
  platform: "apple" | "google" | "clerk";
  productId: string; // Store product identifier
  status: "active" | "canceled" | "expired" | "in_grace";
  subscriptionTier: string; // "free" | "weekly" | "monthly" | "yearly"
  lastResetAt: number; // Period start timestamp
  musicGenerationsUsed: number;
  autoRenewStatus?: "on" | "off";
  latestReceipt?: string; // Base64 encoded receipt
  lastVerifiedAt: number;
  canceledAt?: number;
}
```

### Plan Configuration
```typescript
const PLAN_CONFIG = {
  free: { musicLimit: 10, periodDays: 30, price: 0 },
  monthly: { musicLimit: Infinity, periodDays: 30, price: 9.99 },
  yearly: { musicLimit: Infinity, periodDays: 365, price: 99.99 }
};
```

## API Design

### Convex Functions

#### Queries
- `billing.getStatus(userId)` → Returns current subscription status and usage
- `billing.getPlans()` → Returns available subscription plans with pricing

#### Mutations
- `billing.confirmPurchase(platform, receipt, productId)` → Verifies and activates subscription
- `billing.restorePurchase(platform, receipt)` → Restores subscription for returning user
- `usage.recordMusicGeneration(userId)` → Increments counter, enforces limits
- `usage.resetCounters(userId)` → Resets usage for new period

#### Actions
- `billing.verifyAppleReceipt(receipt)` → Calls Apple verification API
- `billing.handleServerNotification(payload)` → Processes App Store notifications

## Usage Enforcement Flow

1. **Pre-generation check**: Client calls `billing.getStatus()` before music generation
2. **Limit validation**: If `musicGenerationsUsed >= planLimit`, show paywall
3. **Generation attempt**: Call `usage.recordMusicGeneration()` which:
   - Checks if period expired, resets if needed
   - Validates against current limit
   - Increments counter on success
   - Returns remaining quota
4. **UI update**: Refresh status display with new usage data

## Frontend Integration

### React Native IAP Setup
- Initialize `react-native-iap` on app start
- Register purchase listener for transaction handling
- Fetch available products on user login

### Paywall Triggers
- **Signup flow**: Optional upgrade prompt after profile creation
- **Limit reached**: Full paywall when generation would exceed allowance
- **Settings**: Subscription management screen

### UI Components
- `SubscriptionStatus` - Header banner showing current plan/usage
- `PaywallModal` - Upgrade prompt with plan selection
- `UsageProgress` - Progress bar for free tier usage
- `SubscriptionSettings` - Manage subscription in settings

## Security Considerations

- **Server-side enforcement**: All usage limits enforced in Convex mutations
- **Receipt verification**: All purchases verified server-side before activation
- **Rate limiting**: Prevent abuse of generation endpoints
- **Audit logging**: Track all usage events for debugging

## Testing Strategy

### Unit Tests
- Usage counter logic and period rollover
- Plan configuration and limit enforcement
- Receipt verification (mocked)

### Integration Tests
- End-to-end purchase flow
- Usage tracking across period boundaries
- Subscription restoration

### Mock Data
- Mock Apple receipt responses for development
- Test subscription states for UI components

## Implementation Phases

### Phase 1: Core Infrastructure (Current)
- [ ] Update Convex schema
- [ ] Implement usage tracking mutations
- [ ] Create subscription status management
- [ ] Add frontend gating logic

### Phase 2: IAP Integration (Post-Apple Account)
- [ ] Set up Apple Developer account
- [ ] Configure App Store Connect products
- [ ] Implement receipt verification
- [ ] Add server notification handling

### Phase 3: Polish & Optimization
- [ ] Add comprehensive testing
- [ ] Implement analytics tracking
- [ ] Optimize performance
- [ ] Add error handling and recovery

## Future Enhancements

- **Google Play integration**: Extend to Android billing
- **Trial periods**: Add free trial support
- **Family sharing**: Support Apple Family Sharing
- **Usage analytics**: Detailed usage reporting
- **Promotional offers**: Discount codes and special pricing

## Dependencies

- `react-native-iap` - In-app purchase handling
- `@clerk/clerk-expo` - User authentication
- `convex` - Backend database and functions
- Apple Developer Account (for production)
- App Store Connect (for product configuration)

## Success Metrics

- **Conversion rate**: Free to paid subscription conversion
- **Retention**: Monthly active users by subscription tier
- **Usage patterns**: Music generations per user per period
- **Revenue**: Monthly recurring revenue growth
- **Churn**: Subscription cancellation rates

---

*Last updated: 2025-10-02*
*Version: 1.0*
