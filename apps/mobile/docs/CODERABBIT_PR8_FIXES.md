# CodeRabbit PR #8 Fixes - Progress Tracker

**PR**: #8 - "Add RevenueCat reconciliation for subscription management"
**Status**: In Progress
**Started**: 2025-10-28
**Total Issues**: 30 (9 critical, 16 code quality, 5 observations)

---

## Progress Summary

- **Phase 1 (Critical)**: 0/6 completed ⬜⬜⬜⬜⬜⬜
- **Phase 2 (Type Safety)**: 0/4 completed ⬜⬜⬜⬜
- **Phase 3 (Quality & UX)**: 0/9 completed ⬜⬜⬜⬜⬜⬜⬜⬜⬜
- **Testing**: 0/2 completed ⬜⬜

---

## Phase 1: Critical Security & Bug Fixes

### 🔴 1.1 Add RevenueCat Webhook Signature Verification
**Status**: ⬜ Not Started
**Priority**: SECURITY CRITICAL
**Files**: `packages/backend/convex/http.ts`

**Issue**: RevenueCat webhook at `/webhooks/revenuecat` accepts unauthenticated requests without verifying the `X-RevenueCat-Signature` header, making it vulnerable to spoofing attacks.

**Tasks**:
- [ ] Generate RevenueCat webhook secret for dev environment in Convex dashboard
- [ ] Generate RevenueCat webhook secret for prod environment in Convex dashboard
- [ ] Add environment variable `REVENUECAT_WEBHOOK_SECRET` to Convex
- [ ] Implement HMAC-SHA256 signature verification function (similar to Clerk webhook pattern)
- [ ] Add signature verification to `/webhooks/revenuecat` endpoint (line 476)
- [ ] Return 401 Unauthorized for invalid signatures
- [ ] Add logging for failed verification attempts

**Reference**: CodeRabbit comment on `http.ts:476`

---

### 🔴 1.2 Fix User ID Mapping Throughout
**Status**: ⬜ Not Started
**Priority**: CRITICAL
**Files**: `packages/backend/convex/http.ts`, `packages/backend/convex/revenueCatBilling.ts`

**Issue**: Webhook handler passes RevenueCat's `app_user_id` (string) directly to mutations expecting `v.id("users")`, causing type validation errors.

**Clarification**: `app_user_id` IS the Convex `users._id` (confirmed via code analysis), but needs proper type handling.

**Tasks**:
- [ ] Update `http.ts:498` - validate `app_user_id` format before passing to mutation
- [ ] Add type guard function `isValidUserId(id: string): id is Id<"users">`
- [ ] Update error handling for invalid/missing user IDs
- [ ] Add logging for user ID validation failures
- [ ] Remove unsafe `as any` casts after proper validation

**Reference**: CodeRabbit comment on `http.ts:498`

---

### 🔴 1.3 Fix Divide-by-Zero in Progress Bar
**Status**: ⬜ Not Started
**Priority**: CRITICAL (UI crash)
**Files**: `apps/mobile/app/components/billing/UsageWithReconciliation.tsx`

**Issue**: Progress bar width calculation at line 83 uses `(usage.currentUsage / usage.limit) * 100` which produces `Infinity`/`NaN` when `limit === 0`, breaking component layout.

**Tasks**:
- [ ] Update line 83 with safe calculation:
  ```typescript
  style={{
    width: `${usage.limit > 0 ? Math.min(100, (usage.currentUsage / usage.limit) * 100) : 0}%`
  }}
  ```
- [ ] Test with `limit = 0`, `limit = 1`, `usage > limit` edge cases
- [ ] Add comment explaining the guard

**Reference**: CodeRabbit comment on `UsageWithReconciliation.tsx:83`

---

### 🔴 1.4 Fix entitlementIds Extraction Bug
**Status**: ⬜ Not Started
**Priority**: CRITICAL (always empty array)
**Files**: `packages/backend/convex/http.ts`

**Issue**: Line 484 uses `event.event?.entitlements?.keys ?? []` but `.keys` is undefined for plain objects, always returning empty array.

**Tasks**:
- [ ] Replace line 484:
  ```typescript
  // OLD: const entitlementIds = event.event?.entitlements?.keys ?? [];
  // NEW:
  const entitlements = (event.event?.entitlements ?? {}) as Record<string, unknown>;
  const entitlementIds = Object.keys(entitlements);
  ```
- [ ] Test with various RevenueCat webhook event types
- [ ] Verify entitlements are properly extracted

**Reference**: CodeRabbit comment on `http.ts:484`

---

### 🔴 1.5 Fix Reconciliation Cron Issues
**Status**: ⬜ Not Started
**Priority**: CRITICAL (reconciliation broken)
**Files**: `packages/backend/convex/revenueCatBilling.ts`

**Issues**:
1. TypeScript error: `activeSubscriptionId` doesn't exist on user union type (lines 364-436)
2. Calls RevenueCat with wrong identifier (should use app_user_id which equals users._id)
3. Duplicate queries fetching same user multiple times
4. Patches by wrong subscription ID (`user.activeSubscriptionId` instead of `subscriptionStatusId`)

**Tasks**:
- [ ] Fix TypeScript union type narrowing for `user.activeSubscriptionId`
- [ ] Remove duplicate user queries (fetch once, reuse)
- [ ] Update RevenueCat API call to use correct identifier (app_user_id = user._id)
- [ ] Fix database patch to use `subscriptionStatusId` instead of `user.activeSubscriptionId`
- [ ] Add comprehensive error handling for each step
- [ ] Add logging for reconciliation process (checked, updated counts)
- [ ] Test cron job execution

**Reference**: CodeRabbit comments on `revenueCatBilling.ts:364-436`

---

### 🔴 1.6 Remove Unsupported Platforms from Schema
**Status**: ⬜ Not Started
**Priority**: HIGH (type safety)
**Files**: `packages/backend/convex/schema.ts`, `packages/backend/convex/revenueCatBilling.ts`

**Issue**: Schema includes platforms we don't support (`amazon`, `mac_app_store`, `promotional`), and `getPlatformFromStore` returns values not in schema (`web`, `roku`), forcing unsafe `as any` casts.

**Decision**: Support only **Apple App Store, Google Play Store, Stripe (web), and Clerk (free users)**

**Tasks**:
- [ ] Update `schema.ts` - remove `amazon`, `mac_app_store`, `promotional` from `subscriptionStatuses.platform`
- [ ] Update `schema.ts` - keep or remove `roku`, `web` from `subscriptionLog.platform` (decision needed)
- [ ] Update `revenueCatBilling.ts:26` - `getPlatformFromStore()` to only return supported platforms
- [ ] Remove all `as any` casts related to platform mapping
- [ ] Update any type definitions to use narrowed platform union
- [ ] Search codebase for platform string literals and update

**Reference**: CodeRabbit comment on `revenueCatBilling.ts:26`

---

## Phase 2: Type Safety & Architecture

### 🟡 2.1 Update Webhook Mutation Signatures
**Status**: ⬜ Not Started
**Priority**: HIGH (type correctness)
**Files**: `packages/backend/convex/revenueCatBilling.ts`

**Issue**: 4 webhook mutations have incorrect argument types:
1. Accept `userId: v.id("users")` but receive string from webhook
2. Accept `expirationAtMs`/`purchasedAtMs` as `v.string()` but RevenueCat may send numbers

**Mutations to update**:
- `updateSubscriptionFromWebhook` (lines 148-161)
- `handleSubscriptionCanceled` (lines 166-176)
- `handleSubscriptionExpired` (lines 188-214)
- `handleNonRenewal` (lines 216-236)

**Tasks**:
- [ ] Change argument from `userId: v.id("users")` to `appUserId: v.string()`
- [ ] Add internal user lookup by app_user_id (which equals _id)
- [ ] Change timestamp fields to `v.union(v.string(), v.number())`
- [ ] Add normalization logic to convert to consistent type (number)
- [ ] Update all 4 mutations with new signatures
- [ ] Update callers to pass correct types
- [ ] Test with real RevenueCat webhook payloads

**Reference**: CodeRabbit comments on `revenueCatBilling.ts:148-236`

---

### 🟡 2.2 Fix TypeScript Errors in Reconciliation
**Status**: ⬜ Not Started (covered in 1.5)
**Priority**: HIGH
**Files**: `packages/backend/convex/revenueCatBilling.ts`

**Note**: Most issues covered in 1.5. Additional fixes:

**Tasks**:
- [ ] Ensure all TypeScript errors in reconciliation function are resolved
- [ ] Add proper type guards for user union types
- [ ] Verify no `@ts-ignore` or `@ts-expect-error` comments added

**Reference**: CodeRabbit comments on `revenueCatBilling.ts:364-436`

---

### 🟡 2.3 Move HTTP Calls to Actions (Convex Best Practice)
**Status**: ⬜ Not Started
**Priority**: MEDIUM (architectural)
**Files**: `packages/backend/convex/revenueCatBilling.ts`, `packages/backend/convex/crons.ts`

**Issue**: `reconcileStaleSubscriptions` is a mutation that makes HTTP calls to RevenueCat API (lines 364-436). Convex best practice: I/O operations should be in actions, database writes in mutations.

**Refactor Strategy**: Split into action (HTTP) + mutation (DB writes)

**Tasks**:
- [ ] Create new query `getStaleSubscriptions` (extract query logic from mutation)
- [ ] Create new mutation `reconcileSingleSubscription` (database update logic only)
- [ ] Convert `reconcileStaleSubscriptions` from mutation to action
- [ ] Action orchestrates: fetch stale subscriptions, call RevenueCat API, call mutation for each
- [ ] Update `crons.ts:43` to call action instead of mutation
- [ ] Add comprehensive error handling in action
- [ ] Add logging for orchestration (checked, updated counts)
- [ ] Test cron job with new structure
- [ ] Monitor action latency (should be <10s per subscription)

**Reference**: CodeRabbit comments on `revenueCatBilling.ts:339-436`

---

### 🟡 2.4 Remove All `any` Types
**Status**: ⬜ Not Started
**Priority**: MEDIUM (type safety)
**Files**: Multiple mobile app files

**Issues**:
1. `UsageWithReconciliation.tsx:21-22` - Uses `any` for reconciled usage state
2. `useSubscriptionStore.ts:72-85` - Result type not exported, causing `any` at call sites
3. Various unsafe casts after ID mapping fixes

**Tasks**:
- [ ] Create typed interface for reconciled usage in `UsageWithReconciliation.tsx`
- [ ] Export result type from `useSubscriptionStore.ts`
- [ ] Update all call sites to use exported type
- [ ] Remove all `as any` casts (should be handled by earlier fixes)
- [ ] Run `pnpm type-check` to verify no type errors
- [ ] Add type annotations where TypeScript can't infer

**Reference**: CodeRabbit comments on mobile app files

---

## Phase 3: Code Quality & UX

### 🟢 3.1 Add Reconciliation TTL/Backoff
**Status**: ⬜ Not Started
**Priority**: MEDIUM (performance)
**Files**: `packages/backend/convex/usage.ts`, `apps/mobile/app/hooks/useMusicGeneration.ts`

**Issue**: No TTL on reconciliation - could reconcile too frequently, wasting API calls and causing performance issues.

**Tasks**:
- [ ] Add TTL constant (5-15 minutes recommended)
- [ ] Update reconciliation logic to check `lastVerifiedAt` timestamp
- [ ] Skip reconciliation if verified within TTL window
- [ ] Add logging when skipping due to TTL
- [ ] Document TTL behavior in code comments
- [ ] Add fallback to cached data if reconciliation skipped

**Reference**: CodeRabbit comment on `usage.ts:354-369`

---

### 🟢 3.2 Extract Duplicate UI Logic
**Status**: ⬜ Not Started
**Priority**: MEDIUM (DRY principle)
**Files**: `apps/mobile/app/hooks/useMusicGeneration.ts`

**Issue**: Lines 72-107 contain duplicated Alert/paywall logic for limit-reached scenarios.

**Tasks**:
- [ ] Create helper function `showLimitReachedDialog(usage, showPaywall)`
- [ ] Extract duplicated Alert/paywall logic into helper
- [ ] Update both call sites to use helper
- [ ] Add fallback to cached data if reconciliation fails
- [ ] Add offline scenario handling

**Reference**: CodeRabbit comment on `useMusicGeneration.ts:72-107`

---

### 🟢 3.3 Improve Error Handling & User Feedback
**Status**: ⬜ Not Started
**Priority**: MEDIUM (UX)
**Files**: `apps/mobile/app/components/billing/UsageWithReconciliation.tsx`

**Issue**: Line 39-44 catch block doesn't surface errors to user, only logs to console.

**Tasks**:
- [ ] Add `Alert.alert` in catch block for sync failures
- [ ] Show user-friendly error messages (not raw error text)
- [ ] Add retry button in error alert
- [ ] Add offline detection and appropriate messaging
- [ ] Show baseline usage data even if reconciliation fails
- [ ] Add loading states during reconciliation

**Reference**: CodeRabbit comment on `UsageWithReconciliation.tsx:39-44`

---

### 🟢 3.4 Add Structured Logging
**Status**: ⬜ Not Started
**Priority**: MEDIUM (observability)
**Files**: `packages/backend/convex/usage.ts`, `packages/backend/convex/revenueCatBilling.ts`

**Issue**: Using `console.log` instead of structured logger, missing correlation IDs for debugging.

**Tasks**:
- [ ] Replace `console.log` with structured logger (if available) or structured console output
- [ ] Add correlation IDs for tracking reconciliation flows
- [ ] Include context in logs: userId, reconciliation result, timestamp
- [ ] Add log levels (info, warn, error)
- [ ] Add metrics for monitoring reconciliation success rates
- [ ] Log webhook processing results

**Reference**: CodeRabbit comment on `usage.ts:360-363`

---

### 🟢 3.5 Add Accessibility Features
**Status**: ⬜ Not Started
**Priority**: LOW (a11y)
**Files**: `apps/mobile/app/components/billing/UsageWithReconciliation.tsx`

**Issue**: Refresh button (lines 54-63) missing accessibility attributes.

**Tasks**:
- [ ] Add `accessibilityRole="button"` to Refresh TouchableOpacity
- [ ] Add `accessibilityLabel` with usage context (e.g., "Refresh usage data")
- [ ] Add `accessibilityHint` for screen reader users
- [ ] Add `accessibilityState={{ busy: isReconciling }}` during loading
- [ ] Test with iOS VoiceOver
- [ ] Test with Android TalkBack (if applicable)

**Reference**: CodeRabbit comment on `UsageWithReconciliation.tsx:54-63`

---

### 🟢 3.6 Code Cleanup
**Status**: ⬜ Not Started
**Priority**: LOW (code quality)
**Files**: Multiple

**Tasks**:
- [ ] Remove unused `getPlatformFromStore` helper from `http.ts:22-33` (if no longer used after refactor)
- [ ] Fix comment mismatch in `revenueCatBilling.ts:311-325` ("> 24h ago" vs `lt` operator)
- [ ] Improve state change detection to include `platform` and `expiresAt` changes (lines 182-186, 216-233)
- [ ] Check mutation results in `http.ts:509-516` and return meaningful status codes
- [ ] Narrow return types - use union literals instead of unbounded strings (lines 249-254)
- [ ] Add logging for cron job results in `crons.ts:40-45` (checked, updated counts)

**Reference**: Multiple CodeRabbit nitpick comments

---

### 🟢 3.7 Update billing-design.md Documentation
**Status**: ⬜ Not Started
**Priority**: MEDIUM (documentation accuracy)
**Files**: `apps/mobile/docs/billing-design.md`

**Issue**: Doc mentions generic subscription platforms but actual implementation supports only Apple, Google, and Stripe.

**Tasks**:
- [ ] Update platform list to: "Apple App Store, Google Play Store, Stripe (web)"
- [ ] Clarify "clerk" platform represents free users (not a payment platform)
- [ ] Update any diagrams or examples to reflect current architecture
- [ ] Add note about removed platforms (amazon, mac_app_store, promotional)
- [ ] Update last modified date

**Reference**: User requirement #2

---

### 🟢 3.8 Update REVENUECAT.md Documentation
**Status**: ⬜ Not Started
**Priority**: MEDIUM (security documentation)
**Files**: `apps/mobile/docs/REVENUECAT.md`

**Tasks**:
- [ ] Replace real-looking API keys with placeholders (lines 22-31, 33-35)
- [ ] Add webhook signature verification section (lines 196-203, 403-433)
- [ ] Document how to generate and configure webhook secrets
- [ ] Clarify app_user_id = Convex users._id mapping (lines 212-217, 297-364)
- [ ] Add security best practices section
- [ ] Add troubleshooting section for common issues

**Reference**: CodeRabbit comments on `REVENUECAT.md`

---

### 🟢 3.9 Improve Reconciliation Semantics
**Status**: ⬜ Not Started
**Priority**: LOW (clarity)
**Files**: `packages/backend/convex/usage.ts`

**Issue**: `reconciled: true` returned even when nothing changed (lines 383-391), which is misleading.

**Tasks**:
- [ ] Consider separate flags: `reconciled: boolean`, `changed: boolean`
- [ ] Or change to return `{ status: "unchanged" | "updated" | "error" }`
- [ ] Update callers to handle new semantics
- [ ] Add JSDoc comments explaining return values

**Reference**: CodeRabbit comment on `usage.ts:383-391`

---

## Testing

### 🔵 TEST-1: RevenueCat Sandbox - Reconciliation Testing
**Status**: ⬜ Not Started
**Priority**: CRITICAL

**Test Scenarios**:
- [ ] Cron job executes successfully on schedule
- [ ] Stale subscriptions (>24h) are detected correctly
- [ ] RevenueCat API calls succeed with sandbox data
- [ ] Database updates applied correctly after reconciliation
- [ ] Subscription logs created for state changes
- [ ] Error handling works when RC API fails
- [ ] Error handling works when subscription not found
- [ ] Action→Mutation pattern works end-to-end
- [ ] No TypeScript errors during execution
- [ ] Logging shows checked/updated counts
- [ ] Performance acceptable (<10s per subscription)

---

### 🔵 TEST-2: Other Critical Tests
**Status**: ⬜ Not Started
**Priority**: HIGH

**Test Scenarios**:
- [ ] Webhook signature verification - valid signature accepted
- [ ] Webhook signature verification - invalid signature rejected (401)
- [ ] Webhook signature verification - missing signature rejected (401)
- [ ] User ID mapping - valid app_user_id processed correctly
- [ ] User ID mapping - invalid user ID rejected with error
- [ ] User ID mapping - missing user ID rejected with error
- [ ] Progress bar - renders correctly with limit=0
- [ ] Progress bar - renders correctly with limit=1
- [ ] Progress bar - renders correctly with usage > limit
- [ ] entitlementIds extraction - works with various webhook event types
- [ ] Platform mapping - only returns app_store, play_store, stripe, clerk
- [ ] Run `pnpm type-check` - all TypeScript errors resolved
- [ ] Run `pnpm lint` - no new lint errors
- [ ] Accessibility - VoiceOver works with refresh button

---

## Deployment Checklist

**Pre-Deployment**:
- [ ] All Phase 1 tasks completed and tested
- [ ] All Phase 2 tasks completed and tested
- [ ] TypeScript compilation passes (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] All critical tests pass

**Deployment Steps**:
1. [ ] Generate RevenueCat webhook secret in Convex dashboard (dev)
2. [ ] Add `REVENUECAT_WEBHOOK_SECRET` environment variable (dev)
3. [ ] Deploy backend changes to dev
4. [ ] Test webhook signature verification in dev
5. [ ] Test reconciliation cron in dev
6. [ ] Generate RevenueCat webhook secret in Convex dashboard (prod)
7. [ ] Add `REVENUECAT_WEBHOOK_SECRET` environment variable (prod)
8. [ ] Deploy backend changes to prod
9. [ ] Update RevenueCat webhook URL configuration (prod)
10. [ ] Monitor logs for 24-48 hours
11. [ ] Verify cron job runs successfully
12. [ ] Verify webhook processing works
13. [ ] Deploy mobile app updates (if needed)

**Post-Deployment Monitoring**:
- [ ] Check error rates in first 24 hours
- [ ] Verify reconciliation cron executes daily
- [ ] Monitor webhook processing success rates
- [ ] Check for any type errors or runtime exceptions
- [ ] Verify user-facing features work correctly

---

## Notes & Decisions

**2025-10-28**:
- User confirmed: app_user_id = Convex users._id (no translation needed)
- User confirmed: Remove unsupported platforms (amazon, mac_app_store, promotional) from schema
- User confirmed: Update billing-design.md to reflect Apple + Google + Stripe only
- User confirmed: Reconciliation testing is highest priority
- Created this tracking document to maintain detailed progress

**Platform Support Decision**:
- Supported: Apple App Store, Google Play Store, Stripe (web), Clerk (free users)
- Removed: Amazon, Mac App Store, Promotional, Roku
- Reason: Simplified architecture focusing on primary platforms

**Architecture Decision - Mutations vs Actions**:
- Only 1 mutation needs refactoring: `reconcileStaleSubscriptions`
- Risk level: LOW-MEDIUM
- All other HTTP calls already properly in actions
- Refactor will follow Convex best practices

---

**Last Updated**: 2025-10-28 (Created)
**Document Version**: 1.0
**Total Progress**: 0/30 tasks completed (0%)
