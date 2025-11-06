# RevenueCat Flow Summary

## Complete Flow: From App Start to Subscription Display

### 1. App Initialization (`App.tsx`)

```typescript
// Step 1: Configure RevenueCat SDK
useEffect(() => {
  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  
  await configureRevenueCat(apiKey); // Purchases.configure({ apiKey })
}, []);
```

**What happens:**
- RevenueCat SDK is initialized with your API key
- SDK is ready to handle purchases and check subscription status
- SDK caches customer info locally for offline access

---

### 2. User Authentication (`useRevenueCatSync.ts`)

```typescript
// Step 2: Link RevenueCat to Convex user
if (isSignedIn) {
  const { userId: convexUserId } = await ensureCurrentUser({});
  await identifyUser(convexUserId); // Purchases.logIn(convexUserId)
}
```

**What happens:**
- When user signs in, RevenueCat's `app_user_id` is set to Convex `user._id`
- This links the RevenueCat account to your Convex user
- Webhooks will receive this ID and update the correct user in Convex DB

**Important:** This is the key connection point. RevenueCat's `app_user_id` = Convex `user._id`

---

### 3. Reading Subscription Status (`useRevenueCatSubscription.ts`)

```typescript
// Step 3: Read subscription status from RevenueCat
const { subscriptionStatus } = useRevenueCatSubscription();

// Internally calls:
const customerInfo = await Purchases.getCustomerInfo();
const subscriptionState = customerInfoToSubscriptionState(customerInfo);
```

**What happens:**
1. Calls `Purchases.getCustomerInfo()` - gets latest status from RevenueCat SDK
2. Checks `customerInfo.entitlements.active` - determines if user has active subscription
3. Maps product IDs to tiers:
   - `eveokee_premium_monthly` → `monthly`
   - `eveokee_premium_annual` → `yearly`
   - No entitlements → `free`
4. Determines status:
   - Active entitlements → `active`
   - Entitlements with `willRenew === false` → `in_grace`
   - No entitlements → `expired`
5. Combines with usage data from Convex (for music generation counts)

---

### 4. Making a Purchase

```typescript
// Step 4: User purchases subscription
const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

// RevenueCat SDK automatically:
// - Updates customerInfo
// - Triggers customerInfoUpdateListener
// - Sends webhook to backend
```

**What happens:**
1. User completes purchase via App Store/Play Store
2. RevenueCat SDK processes the purchase
3. `customerInfo` is automatically updated with new subscription
4. SDK triggers `customerInfoUpdateListener` (if you set one up)
5. RevenueCat sends webhook to your backend
6. Backend updates Convex DB (for server-side checks)

**Mobile app doesn't wait for webhook** - it reads directly from SDK!

---

### 5. Displaying Status (`SettingsScreen.tsx`)

```typescript
// Step 5: Display subscription status
const { subscriptionStatus, refresh } = useRevenueCatSubscription();

<Text>Plan: {subscriptionStatus?.tier}</Text>
<Text>Status: {subscriptionStatus?.isActive ? 'Active' : 'Expired'}</Text>
<Text>Expires: {new Date(subscriptionStatus?.periodEnd).toLocaleDateString()}</Text>
```

**What happens:**
- UI reads from `subscriptionStatus` which comes directly from RevenueCat
- Status is always up-to-date (no waiting for webhooks)
- If status seems stale, call `refresh()` to get latest

---

## Key Files and Their Roles

### Mobile App Files

| File | Purpose |
|------|---------|
| `App.tsx` | Initializes RevenueCat SDK with API key |
| `app/hooks/useRevenueCatSync.ts` | Links RevenueCat to Convex user via `Purchases.logIn()` |
| `app/hooks/useRevenueCatSubscription.ts` | Reads subscription status from RevenueCat SDK |
| `app/utils/revenueCatSubscription.ts` | Converts RevenueCat `CustomerInfo` to app format |
| `app/utils/revenueCat.ts` | Low-level RevenueCat SDK wrappers |

### Backend Files

| File | Purpose |
|------|---------|
| `packages/backend/convex/webhooks/handlers/revenuecat.ts` | Receives webhooks from RevenueCat |
| `packages/backend/convex/revenueCatBilling.ts` | Updates Convex DB from webhook events |
| `packages/backend/convex/billing.ts` | Server-side subscription queries (for API gating) |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Action: Purchase                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RevenueCat SDK (Mobile App)                     │
│  - Processes purchase                                        │
│  - Updates customerInfo automatically                       │
│  - Triggers customerInfoUpdateListener                      │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────────────┐
│  Mobile App Reads   │          │  RevenueCat Sends Webhook   │
│  from SDK           │          │  to Backend                 │
│                     │          │                             │
│  customerInfo       │          │  POST /webhooks/revenuecat  │
│  (immediate)        │          │  (async, may be delayed)   │
└─────────────────────┘          └─────────────────────────────┘
         │                                    │
         │                                    ▼
         │                    ┌─────────────────────────────┐
         │                    │   Convex Backend            │
         │                    │   - Updates DB              │
         │                    │   - Logs to audit trail    │
         │                    │   - Used for API gating     │
         │                    └─────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  UI Updates         │
│  (immediate)        │
│                     │
│  Status: Active     │
│  Tier: Monthly      │
│  Expires: ...       │
└─────────────────────┘
```

---

## Why This Approach?

### Benefits

1. **Real-time Status**: Mobile reads directly from RevenueCat SDK (no delays)
2. **Single Source of Truth**: RevenueCat is authoritative for subscription status
3. **Offline Support**: SDK caches customer info locally
4. **Automatic Updates**: SDK listens for subscription changes
5. **No Sync Issues**: Don't wait for webhooks to process

### Backend Still Needed For

1. **Server-side Gating**: Check subscription for API requests
2. **Audit Log**: Track all subscription events
3. **Usage Tracking**: Music generation counts (app-specific)
4. **Reconciliation**: Daily cron ensures backend stays in sync

---

## Common Questions

### Q: Why read from RevenueCat instead of Convex DB?

**A:** RevenueCat SDK is the authoritative source. It:
- Has the latest status immediately after purchase
- Handles subscription changes automatically
- Works offline with cached data
- Doesn't depend on webhook processing delays

### Q: What if webhook fails or is delayed?

**A:** Mobile app doesn't care! It reads directly from RevenueCat SDK. Backend reconciliation handles sync issues.

### Q: How do I refresh subscription status?

**A:** Call `refresh()` from `useRevenueCatSubscription()` hook, or `loadCustomerInfo()` from `useRevenueCat()` hook.

### Q: What about usage data (music generations)?

**A:** Usage data still comes from Convex DB because it's app-specific. Only subscription status comes from RevenueCat.

---

## Migration Guide

### Before (Reading from Convex DB)

```typescript
// OLD: Reading from Convex DB
const { subscriptionStatus } = useSubscription(); // api.billing.getCurrentUserStatus
```

### After (Reading from RevenueCat)

```typescript
// NEW: Reading from RevenueCat SDK
const { subscriptionStatus, refresh } = useRevenueCatSubscription();
```

That's it! The hook handles all the complexity of reading from RevenueCat and converting to your app's format.

