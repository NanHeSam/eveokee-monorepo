# Testing Guide: PR #8 RevenueCat Reconciliation Fixes

**Date**: 2025-10-28
**PR**: #8 - "Add RevenueCat reconciliation for subscription management"
**Fixes**: 30 CodeRabbit issues (9 critical, 16 code quality, 5 observations)

---

## ✅ Pre-Test Validation

### Static Analysis (Already Passed)
- ✅ **TypeScript**: `pnpm --filter mobile type-check` - PASSED
- ✅ **Linting**: `pnpm lint` - PASSED
- ✅ **Build**: Ready for deployment testing

---

## Testing Phases

### Phase 1: Environment Setup (REQUIRED FIRST)

#### 1.1 Generate RevenueCat Webhook Secrets

**For Development Environment:**
```bash
# Generate a secure random secret
openssl rand -base64 32
```

**For Production Environment:**
```bash
# Generate a different secure random secret
openssl rand -base64 32
```

#### 1.2 Configure Convex Environment Variables

**Development** (`npx convex env set --deployment dev`):
```bash
cd packages/backend
npx convex env set REVENUECAT_WEBHOOK_SECRET "<your-dev-secret-from-step-1.1>"
```

**Production** (`npx convex env set --deployment prod`):
```bash
cd packages/backend
npx convex env set REVENUECAT_WEBHOOK_SECRET "<your-prod-secret-from-step-1.1>"
```

#### 1.3 Update RevenueCat Dashboard

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to: **Integrations → Webhooks**
3. Find your webhook configuration
4. Set **Authorization Header**:
   - Format: `Bearer <your-secret-from-step-1.1>`
   - Example: `Bearer abc123xyz456...`
5. Click **Save**

#### 1.4 Deploy Backend Changes

```bash
cd packages/backend
npx convex deploy
```

**Expected Output:**
```
✓ Deployed convex functions
✓ Schema updated
✓ Cron jobs registered
```

---

### Phase 2: Webhook Security Testing (CRITICAL)

#### Test 2.1: Valid Webhook Signature ✅
**What**: Test that webhooks with correct authorization are accepted

**Setup**:
1. Use RevenueCat's "Send Test Event" feature in dashboard
2. Or use curl to simulate webhook:

```bash
curl -X POST https://your-convex-deployment.convex.cloud/webhooks/revenuecat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-webhook-secret>" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "<valid-convex-user-id>",
      "product_id": "eveokee_premium_monthly",
      "store": "APP_STORE",
      "expiration_at_ms": "'$(date -v+30d +%s)000'",
      "purchased_at_ms": "'$(date +%s)000'",
      "entitlements": {
        "premium": {}
      }
    }
  }'
```

**Expected Result:**
- ✅ HTTP 200 OK
- ✅ Response: `{"status":"ok"}`
- ✅ Convex logs show: "Successfully synced RevenueCat subscription"

---

#### Test 2.2: Invalid Webhook Signature ❌
**What**: Test that webhooks with wrong/missing authorization are rejected

**Test A - Missing Authorization Header:**
```bash
curl -X POST https://your-convex-deployment.convex.cloud/webhooks/revenuecat \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"TEST"}}'
```

**Expected Result:**
- ✅ HTTP 401 Unauthorized
- ✅ Response: `{"error":"Unauthorized"}`
- ✅ Convex logs: "RevenueCat webhook missing or invalid Authorization header"

**Test B - Wrong Secret:**
```bash
curl -X POST https://your-convex-deployment.convex.cloud/webhooks/revenuecat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WRONG_SECRET" \
  -d '{"event":{"type":"TEST"}}'
```

**Expected Result:**
- ✅ HTTP 401 Unauthorized
- ✅ Response: `{"error":"Unauthorized"}`
- ✅ Convex logs: "RevenueCat webhook authorization token mismatch"

---

### Phase 3: Reconciliation Testing (HIGH PRIORITY)

#### Test 3.1: Manual Reconciliation Trigger

**Setup**: Use Convex dashboard to manually run the reconciliation cron

1. Open Convex Dashboard → Functions
2. Find: `revenueCatBilling:reconcileStaleSubscriptions`
3. Click "Run" (no arguments needed)

**Expected Behavior:**
- ✅ Action executes successfully
- ✅ Logs show: "Reconciliation completed: X checked, Y updated"
- ✅ No errors about HTTP calls in mutations (we moved them to actions!)

**Check Logs For:**
```
✓ Fetching stale subscriptions...
✓ Calling RevenueCat API for user <userId>
✓ Reconciled stale subscription for user <userId>: active → expired
✓ Reconciliation completed: 5 checked, 2 updated
```

---

#### Test 3.2: Cron Job Execution

**Setup**: Wait for cron job to run (midnight UTC) or manually trigger

**Verification:**
1. Open Convex Dashboard → Cron Jobs
2. Find: `revenuecat-reconciliation`
3. Check last run status and logs

**Expected:**
- ✅ Cron runs daily at 00:00 UTC
- ✅ No errors in execution
- ✅ Logs show checked/updated counts

---

#### Test 3.3: Reconciliation with Stale Data

**Scenario**: Backend subscription status differs from RevenueCat

**Setup:**
1. Create a test user with active subscription
2. Manually update `lastVerifiedAt` to >24 hours ago:
   ```javascript
   // In Convex dashboard
   await ctx.db.patch(subscriptionId, {
     lastVerifiedAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
   });
   ```
3. Cancel subscription in RevenueCat
4. Run reconciliation action

**Expected Result:**
- ✅ Subscription found in stale query
- ✅ RevenueCat API called successfully
- ✅ Subscription status updated: `active` → `expired`
- ✅ `subscriptionLog` entry created with `eventType: "RECONCILIATION"`
- ✅ `lastVerifiedAt` updated to current time

---

### Phase 4: Mobile App Testing

#### Test 4.1: Progress Bar Edge Cases

**Test Divide-by-Zero Fix:**

1. Create a test user with `limit: 0`
2. Open Usage screen in mobile app
3. Verify progress bar renders without crash
4. Check that width is `0%` (not `NaN%` or `Infinity%`)

**Test Cases:**
- ✅ `limit = 0, usage = 0` → Width: 0%
- ✅ `limit = 0, usage = 5` → Width: 0%
- ✅ `limit = 10, usage = 0` → Width: 0%
- ✅ `limit = 10, usage = 5` → Width: 50%
- ✅ `limit = 10, usage = 10` → Width: 100%
- ✅ `limit = 10, usage = 15` → Width: 100% (capped)

---

#### Test 4.2: Usage Reconciliation in Mobile

**Scenario**: User checks usage, mobile reconciles with RevenueCat

**Steps:**
1. Open mobile app (logged in)
2. Navigate to Usage screen with reconciliation
3. Click "Refresh" button
4. Observe loading state

**Expected Behavior:**
- ✅ Loading indicator appears
- ✅ RevenueCat customer info fetched
- ✅ Backend reconciliation mutation called
- ✅ Usage data updated with correct values
- ✅ Green "✓ Synced with RevenueCat" message appears
- ✅ No TypeScript errors (we added proper types!)

**Verify in Logs:**
- ✅ "Usage reconciled with RevenueCat"
- ✅ "Reconciled subscription: active → active" (or status change)

---

### Phase 5: Platform Validation

#### Test 5.1: Supported Platforms Only

**Test A - Apple App Store (Supported):**
```bash
# Send webhook with APP_STORE
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"event":{"store":"APP_STORE", ...}}'
```
**Expected**: ✅ Accepted, `platform: "app_store"`

**Test B - Google Play Store (Supported):**
```bash
# Send webhook with PLAY_STORE
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"event":{"store":"PLAY_STORE", ...}}'
```
**Expected**: ✅ Accepted, `platform: "play_store"`

**Test C - Stripe (Supported):**
```bash
# Send webhook with STRIPE
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"event":{"store":"STRIPE", ...}}'
```
**Expected**: ✅ Accepted, `platform: "stripe"`

**Test D - Amazon (Unsupported):**
```bash
# Send webhook with AMAZON
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"event":{"store":"AMAZON", ...}}'
```
**Expected**: ✅ Accepted, but `platform: undefined` (filtered out by `getPlatformFromStore`)

---

### Phase 6: Type Safety Validation

#### Test 6.1: Timestamp Normalization

**Scenario**: RevenueCat sends timestamps as strings or numbers

**Test A - String Timestamps:**
```javascript
// Webhook payload
{
  "expiration_at_ms": "1735689600000",  // String
  "purchased_at_ms": "1704153600000"     // String
}
```
**Expected**: ✅ Parsed to number, stored correctly

**Test B - Number Timestamps:**
```javascript
// Webhook payload
{
  "expiration_at_ms": 1735689600000,  // Number
  "purchased_at_ms": 1704153600000     // Number
}
```
**Expected**: ✅ Stored correctly as-is

---

#### Test 6.2: EntitlementIds Extraction

**Test**: Verify entitlements are correctly extracted

**Webhook Payload:**
```json
{
  "event": {
    "entitlements": {
      "premium": { "expires_date": "..." },
      "pro": { "expires_date": "..." }
    }
  }
}
```

**Expected**:
- ✅ `entitlementIds = ["premium", "pro"]`
- ✅ Not empty array (bug was `.keys` returning undefined)
- ✅ Stored in `subscriptionLog.entitlementIds`

---

### Phase 7: User ID Validation

#### Test 7.1: Valid User ID Format

**Valid Convex ID**: `jh73k2n9x8p5q6r7s8t9u0v1w2x3y4z5`

**Test:**
```bash
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "app_user_id": "jh73k2n9x8p5q6r7s8t9u0v1w2x3y4z5",
      ...
    }
  }'
```

**Expected:**
- ✅ Passes `isValidConvexId()` type guard
- ✅ HTTP 200 OK
- ✅ Subscription updated

---

#### Test 7.2: Invalid User ID Format

**Invalid IDs to Test:**
- Empty string: `""`
- SQL injection: `"; DROP TABLE users; --"`
- Special chars: `<script>alert('xss')</script>`
- Spaces: `"abc def ghi"`

**Test:**
```bash
curl -X POST <webhook-url> \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "app_user_id": "; DROP TABLE users; --",
      ...
    }
  }'
```

**Expected:**
- ✅ HTTP 400 Bad Request
- ✅ Response: `{"status":"error","reason":"Invalid user ID format"}`
- ✅ Logs: "RevenueCat webhook invalid user ID format"

---

## Testing Checklist Summary

### Critical (Must Pass Before Production)
- [ ] ✅ TypeScript compilation (`pnpm type-check`)
- [ ] ✅ Linting (`pnpm lint`)
- [ ] ✅ Webhook secret configured (dev + prod)
- [ ] ✅ Backend deployed (`npx convex deploy`)
- [ ] ✅ Valid webhook signature accepted (Test 2.1)
- [ ] ✅ Invalid webhook signature rejected (Test 2.2)
- [ ] ✅ Reconciliation action runs without errors (Test 3.1)
- [ ] ✅ User ID validation works (Test 7.1, 7.2)

### High Priority (Should Test)
- [ ] ✅ Reconciliation updates stale subscriptions (Test 3.3)
- [ ] ✅ Progress bar handles divide-by-zero (Test 4.1)
- [ ] ✅ Mobile reconciliation works (Test 4.2)
- [ ] ✅ Supported platforms accepted (Test 5.1)
- [ ] ✅ Timestamp normalization works (Test 6.1)
- [ ] ✅ EntitlementIds extracted correctly (Test 6.2)

### Medium Priority (Nice to Have)
- [ ] ✅ Cron job executes on schedule (Test 3.2)
- [ ] ✅ Unsupported platforms filtered (Test 5.1.D)
- [ ] ✅ Error handling for missing fields

---

## Rollback Plan

If critical issues are found:

1. **Revert Backend Deployment:**
   ```bash
   cd packages/backend
   npx convex rollback
   ```

2. **Remove Webhook Secret from RevenueCat:**
   - Go to RevenueCat Dashboard
   - Remove Authorization header temporarily
   - Webhooks will be accepted (but unverified) until fix deployed

3. **Check Git History:**
   ```bash
   git log --oneline -10
   # Find commit before PR #8 fixes
   git revert <commit-hash>
   ```

---

## Success Criteria

✅ **All Critical Tests Pass**
✅ **No TypeScript Errors**
✅ **No Runtime Errors in Logs**
✅ **Webhook Security Enforced**
✅ **Reconciliation Works Correctly**
✅ **Mobile App Functions Without Crashes**

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Mark PR #8 as "Ready for Review"
2. ✅ Add test results to PR description
3. ✅ Request code review from team
4. ✅ Merge to main branch
5. ✅ Monitor production logs for 24-48 hours
6. ✅ Verify cron job runs successfully at midnight UTC

---

## Troubleshooting

### Issue: Webhook returns 500 error
**Solution**: Check Convex logs for stack trace, likely missing environment variable

### Issue: Reconciliation action times out
**Solution**: Check number of stale subscriptions, may need to add batching for large datasets

### Issue: TypeScript errors after deployment
**Solution**: Run `pnpm type-check` locally first, regenerate Convex types with `npx convex dev`

### Issue: Progress bar still shows NaN
**Solution**: Clear app cache, verify backend returns correct usage data

---

**Last Updated**: 2025-10-28
**Document Version**: 1.0
**Status**: Ready for Testing
