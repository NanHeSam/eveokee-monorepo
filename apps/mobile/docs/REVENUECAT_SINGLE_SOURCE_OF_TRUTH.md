# RevenueCat as Single Source of Truth

This document explains how the mobile app uses RevenueCat SDK as the single source of truth for subscription status.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (iOS/Android)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. App Initialization                                      │
│     └─> Purchases.configure(apiKey)                        │
│                                                              │
│  2. User Authentication                                      │
│     └─> Purchases.logIn(convexUserId)                      │
│         Sets RevenueCat app_user_id = Convex user._id       │
│                                                              │
│  3. Read Subscription Status                                │
│     └─> Purchases.getCustomerInfo()                         │
│         Returns CustomerInfo with entitlements              │
│                                                              │
│  4. Display Status                                          │
│     └─> customerInfoToSubscriptionState(customerInfo)      │
│         Converts RevenueCat format to app format            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Webhook events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Backend                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  - Receives webhooks from RevenueCat                        │
│  - Updates subscriptionStatuses table (snapshot)            │
│  - Used for server-side gating                              │
│  - Audit log for debugging                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. RevenueCat Configuration (`App.tsx`)

```typescript
// App.tsx - Initialization
useEffect(() => {
  const initializeRevenueCat = async () => {
    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    
    await configureRevenueCat(apiKey);
  };
  initializeRevenueCat();
}, []);
```

**What happens:**
- RevenueCat SDK is configured with platform-specific API key
- SDK is ready to handle purchases and check subscription status

### 2. User Identification (`useRevenueCatSync.ts`)

```typescript
// When user signs in
await identifyUser(convexUserId); // Calls Purchases.logIn(convexUserId)
```

**What happens:**
- RevenueCat's `app_user_id` is set to the Convex user ID
- This links RevenueCat account to your Convex user
- Webhooks will receive this ID and can update the correct user

### 3. Reading Subscription Status (`useRevenueCatSubscription.ts`)

```typescript
// Hook that reads directly from RevenueCat
const { subscriptionStatus, refresh } = useRevenueCatSubscription();

// subscriptionStatus contains:
// - tier: 'free' | 'monthly' | 'yearly'
// - status: 'active' | 'expired' | 'canceled' | 'in_grace'
// - isActive: boolean
// - periodEnd: number (timestamp)
// - musicLimit: number
// - musicGenerationsUsed: number (from Convex)
// - remainingQuota: number
```

**What happens:**
1. Calls `Purchases.getCustomerInfo()` to get latest status from RevenueCat
2. Checks `customerInfo.entitlements.active` to determine subscription tier
3. Maps RevenueCat product IDs to app tiers
4. Combines with usage data from Convex (for music generation counts)

### 4. Converting RevenueCat Data (`revenueCatSubscription.ts`)

```typescript
// Utility function that converts RevenueCat CustomerInfo to app format
customerInfoToSubscriptionState(customerInfo, usageData)
```

**Product ID Mapping:**
- `eveokee_premium_monthly` → `monthly` tier
- `eveokee_premium_annual` → `yearly` tier
- No active entitlements → `free` tier

**Status Determination:**
- Active entitlements → `active` status
- Entitlements with `willRenew === false` → `in_grace` status
- No active entitlements → `expired` status

## Usage Example

### Settings Screen

```typescript
import { useRevenueCatSubscription } from '../hooks/useRevenueCatSubscription';

export const SettingsScreen = () => {
  // Read directly from RevenueCat (single source of truth)
  const { subscriptionStatus, loading, refresh } = useRevenueCatSubscription();

  // Refresh after purchase
  const handlePurchaseComplete = async () => {
    await refresh(); // Refreshes from RevenueCat
  };

  return (
    <View>
      <Text>Plan: {subscriptionStatus?.tier}</Text>
      <Text>Status: {subscriptionStatus?.isActive ? 'Active' : 'Expired'}</Text>
      <Text>Expires: {new Date(subscriptionStatus?.periodEnd).toLocaleDateString()}</Text>
    </View>
  );
};
```

### After Purchase

```typescript
import { useRevenueCat } from '../hooks/useRevenueCat';

const handlePurchase = async () => {
  const { purchasePackage, loadCustomerInfo } = useRevenueCat();
  
  // Make purchase
  const result = await purchasePackage(packageToPurchase);
  
  if (result.success) {
    // RevenueCat SDK automatically updates customerInfo
    // But you can also manually refresh
    await loadCustomerInfo();
    
    // Or use the subscription hook's refresh method
    await refresh();
  }
};
```

## Benefits of This Approach

1. **Real-time Status**: Always reads latest status from RevenueCat SDK
2. **No Sync Delays**: No waiting for webhooks to process
3. **Single Source of Truth**: RevenueCat is authoritative for subscription status
4. **Offline Support**: SDK caches customer info locally
5. **Automatic Updates**: SDK listens for subscription changes and updates automatically

## Backend Role

The Convex backend still serves important purposes:

1. **Server-side Gating**: Check subscription status for API requests
2. **Audit Log**: Track all subscription events via webhooks
3. **Usage Tracking**: Track music generation counts (app-specific data)
4. **Reconciliation**: Daily cron job ensures backend stays in sync

## Important Notes

- **Mobile reads from RevenueCat SDK** - Always up-to-date, no delays
- **Backend reads from Convex DB** - Updated via webhooks, used for server-side checks
- **Usage data comes from Convex** - Music generation counts are app-specific
- **Webhooks keep backend in sync** - But mobile doesn't wait for them

## Troubleshooting

### Subscription status not updating after purchase

1. **Check RevenueCat SDK**: Ensure `Purchases.logIn(userId)` was called
2. **Refresh customer info**: Call `refresh()` or `loadCustomerInfo()` after purchase
3. **Check entitlements**: Verify product IDs match in RevenueCat dashboard
4. **Check logs**: RevenueCat SDK logs subscription changes automatically

### Status shows as expired but should be active

1. **Verify entitlements**: Check `customerInfo.entitlements.active` in debugger
2. **Check product mapping**: Ensure product IDs match `REVENUECAT_PRODUCT_TO_TIER`
3. **Refresh**: Call `refresh()` to get latest from RevenueCat
4. **Check RevenueCat dashboard**: Verify subscription is active there

