# Manual Testing Guide: Tier Change Usage Reset

This document outlines how to manually test the tier change usage reset feature using RevenueCat webhooks.

## Prerequisites

- Access to RevenueCat dashboard
- Access to Convex dashboard to monitor database changes
- Test user accounts on each platform (iOS, Android, or Stripe)

## Testing Approach

### Option 1: Using RevenueCat Sandbox Purchases (Recommended)

1. **Setup Test User:**
   - Create a test user in your app using Clerk
   - Note the user's Clerk ID (this will be the RevenueCat app_user_id)
   - Verify free subscription is created in Convex `subscriptionStatuses` table

2. **Test Upgrade Scenario (Free → Premium):**
   - Log into the app as the test user
   - Generate 3-4 music tracks to use up some free credits
   - Check Convex dashboard: `musicGenerationsUsed` should be 3 or 4
   - Make a sandbox purchase of a premium tier (weekly/monthly/yearly)
   - RevenueCat webhook will fire automatically
   - **Expected Result:**
     - `subscriptionTier` changes to the purchased tier
     - `musicGenerationsUsed` resets to 0
     - `lastResetAt` updates to current timestamp
     - For yearly: `customMusicLimit` set to monthly credit (84)
     - For other tiers: `customMusicLimit` is undefined

3. **Test Cross-Tier Upgrade (Weekly → Monthly):**
   - Start with active weekly subscription
   - Use 15-18 out of 20 weekly credits
   - Upgrade to monthly subscription through the app
   - **Expected Result:**
     - `subscriptionTier` changes from "weekly" to "monthly"
     - `musicGenerationsUsed` resets to 0
     - `customMusicLimit` remains undefined

4. **Test Downgrade Scenario (Premium → Free):**
   - Have active premium subscription with high usage (e.g., 80/90)
   - Let subscription expire or cancel it
   - Wait for EXPIRATION webhook
   - **Expected Result:**
     - `subscriptionTier` changes to "free"
     - `musicGenerationsUsed` resets to 0
     - `customMusicLimit` clears to undefined
     - User should have 5/5 free credits available

5. **Test Same-Tier Renewal (No Reset):**
   - Have active monthly subscription with 40/90 used
   - Wait for automatic renewal or manually renew
   - **Expected Result:**
     - `subscriptionTier` remains "monthly"
     - `musicGenerationsUsed` stays at 40 (NOT reset)
     - `customMusicLimit` unchanged

### Option 2: Using RevenueCat Webhook Simulator

RevenueCat provides a webhook event simulator in the dashboard:

1. Go to RevenueCat Dashboard → Project Settings → Integrations → Webhooks
2. Find your webhook endpoint
3. Click "Send Test Event"
4. Select event type and configure payload:

**Test Payload for Tier Change (Free → Monthly):**
```json
{
  "event_type": "PRODUCT_CHANGE",
  "app_user_id": "test-user-clerk-id",
  "product_id": "eveokee_premium_monthly",
  "store": "APP_STORE",
  "entitlements": ["premium"]
}
```

5. Monitor Convex database for changes
6. Verify usage reset behavior

### Option 3: Using Convex Dashboard Direct Testing

For quick verification without real purchases:

1. **Pre-setup:**
   - Note the subscription ID from Convex `subscriptionStatuses` table
   - Note current `musicGenerationsUsed` value
   - Note current `subscriptionTier`

2. **Simulate Tier Change:**
   - In Convex Dashboard, go to Functions
   - Find and run `internal.revenueCatBilling.updateSubscriptionFromWebhook`
   - Provide arguments:
     ```javascript
     {
       userId: "your-test-user-id",
       eventType: "PRODUCT_CHANGE",
       productId: "eveokee_premium_monthly", // or _weekly, _annual
       store: "APP_STORE",
       entitlementIds: ["premium"]
     }
     ```

3. **Verify Results:**
   - Check the subscription record in database
   - Verify the expected changes occurred

## Test Scenarios Checklist

Use this checklist to ensure comprehensive testing:

### Critical Scenarios
- [ ] Free → Monthly upgrade (with partial usage)
- [ ] Free → Weekly upgrade (with partial usage)
- [ ] Free → Yearly upgrade (with partial usage)
- [ ] Weekly → Monthly upgrade (with high usage)
- [ ] Monthly → Yearly upgrade (with high usage)
- [ ] Monthly → Free downgrade (with near-limit usage)
- [ ] Yearly → Free downgrade (with custom limit set)

### Edge Cases
- [ ] Monthly renewal (same tier, no reset)
- [ ] Product ID change (iOS → Android, same tier)
- [ ] Cancellation (tier changes to free)
- [ ] Multiple tier changes in sequence
- [ ] New subscription creation (initial state)
- [ ] Expired subscription re-activation

### Expected Behaviors

#### When Tier Changes (Reset Occurs):
- `musicGenerationsUsed` → 0
- `lastResetAt` → current timestamp
- `subscriptionTier` → new tier
- `customMusicLimit`:
  - Yearly: set to 84 (1000 / 12 rounded up)
  - Other tiers: undefined

#### When Tier Doesn't Change (No Reset):
- `musicGenerationsUsed` → unchanged
- `lastResetAt` → unchanged
- `subscriptionTier` → unchanged
- `customMusicLimit` → unchanged

## Monitoring

### Key Database Fields to Watch

In `subscriptionStatuses` table:
- `subscriptionTier` - should change to new tier
- `musicGenerationsUsed` - should reset to 0 on tier change
- `lastResetAt` - should update on tier change
- `customMusicLimit` - should be set/cleared appropriately
- `lastVerifiedAt` - should always update
- `status` - should reflect current state

In `subscriptionLog` table:
- New entry should be created for tier changes
- `eventType` should match webhook type
- `subscriptionTier` should show new tier

### Convex Dashboard Tips

1. Use the "Data" tab to view real-time table contents
2. Filter by `userId` to track specific user's subscription
3. Sort by `_creationTime` descending to see latest changes
4. Use "Logs" tab to see function execution logs

## Troubleshooting

### Issue: Usage Not Resetting on Tier Change

**Possible Causes:**
1. Product ID not mapped correctly in `REVENUECAT_PRODUCT_TO_TIER`
2. Webhook not reaching the endpoint (check RevenueCat logs)
3. Tier change detection logic not triggering

**Debug Steps:**
1. Check Convex function logs for `updateSubscriptionFromWebhook`
2. Verify `currentSubscription.subscriptionTier !== effectiveTier`
3. Check `productId` matches a known product in constants

### Issue: Custom Limit Not Set for Yearly

**Possible Causes:**
1. `getAnnualMonthlyCredit()` not being called
2. Import missing

**Debug Steps:**
1. Verify import at top of `revenueCatBilling.ts`
2. Check tier change conditional includes yearly handling
3. Verify `PLAN_CONFIG.yearly.musicLimit` is 1000

### Issue: Usage Resetting When It Shouldn't

**Possible Causes:**
1. Same tier being treated as tier change
2. Product ID mapping issue

**Debug Steps:**
1. Log `currentSubscription.subscriptionTier` and `effectiveTier`
2. Verify they are truly the same value
3. Check `tierChanged` boolean in logs

## Success Criteria

A successful tier change reset implementation will show:

✅ **Upgrade scenarios** reset usage to 0 and user gets full new quota
✅ **Downgrade scenarios** reset usage to 0 and prevent incorrect blocking
✅ **Same-tier renewals** do NOT reset usage
✅ **Yearly subscriptions** correctly set monthly credit limit
✅ **No credit loss** on any tier change
✅ **No incorrect blocking** after any tier change
✅ **Subscription log** records all tier changes for audit trail

## Additional Resources

- RevenueCat Webhook Reference: https://www.revenuecat.com/docs/webhooks
- Convex Mutations: https://docs.convex.dev/database/writing-data
- Test Environment Setup: See `packages/backend/__tests__/README.md`

