# Backend Use Case & Dependency Diagram

This document organizes all backend functions by use case, showing root-level (public) functions and their dependency chains. Use this as a navigation guide to understand the codebase flow.

## Use Cases Overview

1. **User Management** - Authentication, profile, account deletion
2. **Diary Management** - Create, read, update, delete diary entries
3. **Music Generation** - Generate music from diary content (manual & automatic)
4. **Music Playback** - List and manage music tracks
5. **Sharing** - Share music tracks publicly
6. **Subscription & Billing** - Plan management, usage tracking, RevenueCat integration
7. **Phone Calls** - Configure and manage scheduled phone calls via VAPI
8. **Webhooks** - External service integrations (Clerk, RevenueCat, Suno, VAPI)
9. **Scheduled Jobs** - Automated background tasks (crons)

---

## 1. User Management Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.users.ensureCurrentUser (mutation)
api.users.getUserProfile (query)
api.users.deleteAccount (mutation)
```

### Dependency Graph

```
ensureCurrentUser (mutation)
  ├─> getOptionalCurrentUser (helper)
  │   └─> ensureCurrentUserHandler (shared logic)
  │       ├─> ctx.auth.getUserIdentity()
  │       ├─> ctx.db.query("users").withIndex("by_clerkId")
  │       └─> internal.billing.createFreeSubscription (if new user)
  │
  └─> internal.users.createUser (if user doesn't exist)
      └─> ctx.db.insert("users")

getUserProfile (query)
  ├─> getOptionalCurrentUser (helper)
  ├─> ctx.db.get(userId)
  ├─> ctx.db.get(activeSubscriptionId)
  ├─> billing.getEffectiveMusicLimit() [from billing.ts]
  └─> billing.getPeriodDurationMs() [from billing.ts]

deleteAccount (mutation)
  ├─> getCurrentUserOrThrow()
  └─> deleteUserData() [from deleteAccount.ts]
      ├─> Deletes: sharedMusic, callSessions, callJobs, callSettings
      ├─> Deletes: music, diaries, subscriptionStatuses, emailNotify
      └─> Deletes: users record
```

### Internal Functions

```
internal.users.createUser (mutation)
  └─> Called by: ensureCurrentUser, Clerk webhook

internal.users.getUserById (query)
  └─> Called by: VAPI integration

internal.users.getUserIdByClerkId (query)
  └─> Called by: usage.checkUsageWithReconciliation
```

---

## 2. Diary Management Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.diaries.createDiary (mutation)
api.diaries.updateDiary (mutation)
api.diaries.deleteDiary (mutation)
api.diaries.listDiaries (query)
```

### Dependency Graph

```
createDiary (mutation)
  ├─> ensureCurrentUser()
  └─> ctx.db.insert("diaries")

updateDiary (mutation)
  ├─> ensureCurrentUser()
  ├─> ctx.db.get(diaryId)
  └─> ctx.db.patch(diaryId)

deleteDiary (mutation)
  ├─> ensureCurrentUser()
  ├─> ctx.db.get(diaryId)
  ├─> ctx.db.query("music").withIndex("by_diaryId")
  │   └─> ctx.db.delete(music._id) [for each]
  └─> ctx.db.delete(diaryId)

listDiaries (query)
  ├─> getOptionalCurrentUser()
  ├─> ctx.db.query("diaries").withIndex("by_userId_and_date")
  └─> Fetches primaryMusic for each diary
      └─> ctx.db.get(primaryMusicId)
```

### Internal Functions

```
internal.diaries.createDiaryInternal (mutation)
  └─> Called by: callDiaryWorkflow.generateDiaryFromCall
```

---

## 3. Music Generation Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.music.startDiaryMusicGeneration (mutation)
```

### Dependency Graph

```
startDiaryMusicGeneration (mutation)
  ├─> ensureCurrentUser()
  ├─> api.diaries.createDiary OR api.diaries.updateDiary
  ├─> Check for existing pending music
  │   └─> ctx.db.query("music").withIndex("by_diaryId")
  ├─> internal.usage.recordMusicGeneration (check limits)
  │   ├─> getUserUsageInfo() [helper in usage.ts]
  │   │   ├─> checkAndResetSubscription() [if period expired]
  │   │   └─> getEffectiveMusicLimit() [from billing.ts]
  │   └─> ctx.db.patch(subscriptionId, musicGenerationsUsed++)
  └─> scheduler.runAfter(0, internal.musicActions.requestSunoGeneration)
      └─> requestSunoGeneration (action)
          ├─> createOpenAIClientFromEnv()
          │   └─> openaiClient.generateMusicData() [external API]
          ├─> createSunoClientFromEnv()
          │   └─> sunoClient.generateMusic() [external API]
          │       └─> Returns taskId
          └─> internal.music.createPendingMusicRecords
              └─> ctx.db.insert("music", status: "pending")
                  └─> Creates 2 music records (musicIndex: 0, 1)
```

### Callback Flow (Suno Webhook)

```
HTTP POST /http/suno-webhook
    ↓
webhooks.handlers.suno.sunoMusicGenerationCallback
    ├─> Validates payload
    ├─> Extracts taskId and tracks
    └─> internal.music.completeSunoTask
        ├─> ctx.db.query("music").withIndex("by_taskId")
        ├─> Updates each music record with track data
        │   └─> ctx.db.patch(music._id, status: "ready", metadata, ...)
        └─> Sets diary.primaryMusicId = musicIndex0._id
```

### Automatic Music Generation (From Phone Calls)

```
callDiaryWorkflow.generateMusicForCallDiary (internal action)
  ├─> internal.usage.recordMusicGeneration
  └─> scheduler.runAfter(0, internal.musicActions.requestSunoGeneration)
      └─> [Same flow as manual generation]
```

### Internal Functions

```
internal.music.createPendingMusicRecords (mutation)
  └─> Called by: musicActions.requestSunoGeneration

internal.music.completeSunoTask (mutation)
  └─> Called by: webhooks.handlers.suno
```

---

## 4. Music Playback Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.music.listPlaylistMusic (query)
api.music.softDeleteMusic (mutation)
```

### Dependency Graph

```
listPlaylistMusic (query)
  ├─> getOptionalCurrentUser()
  ├─> ctx.db.query("music")
  │       .withIndex("by_userId_and_musicIndex")
  │       .eq("musicIndex", 0) [primary tracks only]
  ├─> Filters out soft-deleted (deletedAt === undefined)
  ├─> Collects diary IDs
  └─> Fetches diary metadata for enrichment
      └─> ctx.db.get(diaryId)

softDeleteMusic (mutation)
  ├─> ensureCurrentUser()
  ├─> ctx.db.get(musicId)
  └─> ctx.db.patch(musicId, deletedAt: Date.now())
```

---

## 5. Sharing Use Case

### Public Functions (Root Level)

```
apps/web (share page - public)
    ↓
api.sharing.getSharedMusic (query) [PUBLIC - no auth]
api.sharing.recordShareView (mutation) [PUBLIC - no auth]
```

```
apps/web, apps/mobile (owner)
    ↓
api.sharing.createShareLink (mutation)
```

### Dependency Graph

```
createShareLink (mutation)
  ├─> ensureCurrentUser()
  ├─> ctx.db.get(musicId)
  ├─> Checks for existing share
  │   └─> ctx.db.query("sharedMusic").withIndex("by_musicId")
  ├─> generateShareId() [helper - collision detection]
  └─> ctx.db.insert("sharedMusic")
      └─> Returns shareUrl (using SHARE_BASE_URL env var)

getSharedMusic (query) [PUBLIC]
  ├─> ctx.db.query("sharedMusic").withIndex("by_shareId")
  ├─> ctx.db.get(shared.musicId)
  ├─> ctx.db.get(shared.userId)
  └─> Returns public music data (no auth required)

recordShareView (mutation) [PUBLIC]
  ├─> ctx.db.query("sharedMusic").withIndex("by_shareId")
  ├─> ctx.db.get(shared.musicId)
  └─> ctx.db.patch(shared._id, viewCount++)
```

---

## 6. Subscription & Billing Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.billing.getPlans (query)
api.billing.getCurrentUserStatus (query)
api.usage.getCurrentUserUsage (query)
api.usage.canCurrentUserGenerateMusic (query)
api.usage.checkUsageWithReconciliation (action)
api.usage.recordCurrentUserMusicGeneration (mutation)
```

### Dependency Graph

```
getPlans (query)
  └─> Returns PLAN_CONFIG constants [no deps]

getCurrentUserStatus (query)
  ├─> getOptionalCurrentUser()
  ├─> ctx.db.get(userId)
  ├─> ctx.db.get(activeSubscriptionId)
  ├─> billing.getEffectiveMusicLimit()
  └─> billing.getPeriodDurationMs()

getCurrentUserUsage (query)
  ├─> getOptionalCurrentUser()
  └─> internal.usage.getUsageSnapshot
      └─> getUserUsageInfo() [helper]
          ├─> checkAndResetSubscription()
          └─> Returns usage metrics

canCurrentUserGenerateMusic (query)
  ├─> getOptionalCurrentUser()
  └─> internal.usage.getUsageSnapshot
      └─> [Same as above]

checkUsageWithReconciliation (action)
  ├─> ctx.auth.getUserIdentity()
  ├─> internal.users.getUserIdByClerkId
  └─> internal.revenueCatBilling.reconcileSubscription (action)
      ├─> fetchRevenueCatCustomer() [HTTP call]
      │   └─> createRevenueCatClientFromEnv()
      │       └─> revenueCatClient.getCustomerInfo()
      └─> internal.revenueCatBilling.reconcileSubscriptionWithData
          ├─> ctx.db.get(userId)
          ├─> ctx.db.get(activeSubscriptionId)
          └─> ctx.db.patch(subscriptionId, status)

recordCurrentUserMusicGeneration (mutation)
  ├─> ensureCurrentUser()
  └─> internal.usage.recordMusicGeneration
      └─> [Same flow as startDiaryMusicGeneration]
```

### Internal Functions

```
internal.billing.createFreeSubscription (mutation)
  └─> Called by: users.ensureCurrentUser (on user creation)

internal.usage.recordMusicGeneration (mutation)
  └─> Called by: music.startDiaryMusicGeneration, callDiaryWorkflow.generateMusicForCallDiary

internal.usage.decrementMusicGeneration (mutation)
  └─> Called by: musicActions.requestSunoGeneration (on API errors)

internal.usage.getUsageSnapshot (query)
  └─> Called by: usage.getCurrentUserUsage, usage.canCurrentUserGenerateMusic

internal.revenueCatBilling.reconcileSubscription (action)
  └─> Called by: usage.checkUsageWithReconciliation

internal.revenueCatBilling.reconcileSubscriptionWithData (mutation)
  └─> Called by: revenueCatBilling.reconcileSubscription

internal.revenueCatBilling.reconcileStaleSubscriptions (action)
  └─> Called by: crons.daily (revenuecat-reconciliation)
```

---

## 7. Phone Calls Use Case

### Public Functions (Root Level)

```
apps/web, apps/mobile
    ↓
api.callSettings.upsertCallSettings (mutation)
api.callJobs.getCallJobs (query)
api.callJobs.getCallJobStats (query)
api.callJobs.getCallSessions (query)
api.callJobs.getDashboardStats (query)
```

### Dependency Graph

```
upsertCallSettings (mutation)
  ├─> getCurrentUserOrThrow()
  ├─> phoneHelpers.isValidE164()
  ├─> timezoneHelpers.isValidTimezone()
  ├─> timezoneHelpers.isValidTimeOfDay()
  ├─> cadenceHelpers.isValidCadenceConfig()
  ├─> cadenceHelpers.calculateLocalMinutes()
  ├─> cadenceHelpers.calculateBydayMask()
  ├─> cadenceHelpers.calculateNextRunAtUTC()
  ├─> Checks for existing settings
  │   └─> ctx.db.query("callSettings").withIndex("by_userId")
  └─> ctx.db.patch() OR ctx.db.insert()

getCallJobs (query)
  ├─> getCurrentUserOrThrow()
  └─> ctx.db.query("callJobs")
          .withIndex("by_userId")
          .filter(by status if provided)

getCallJobStats (query)
  ├─> getCurrentUserOrThrow()
  └─> ctx.db.query("callJobs")
          .withIndex("by_userId_and_updatedAt")
          .order("desc")
          .take(limit)

getCallSessions (query)
  ├─> getCurrentUserOrThrow()
  └─> ctx.db.query("callSessions")
          .withIndex("by_userId_and_startedAt")
          .order("desc")

getDashboardStats (query)
  ├─> getCurrentUserOrThrow()
  ├─> ctx.db.query("callSessions")
  │       .withIndex("by_userId_and_startedAt")
  └─> ctx.db.query("diaries")
          .withIndex("by_userId")
          .filter(this month)
```

### Scheduled Call Execution Flow

```
Cron (every minute)
    ↓
crons.interval("call-executor")
    ↓
internal.service.vapi.executor.executeScheduledCalls (action)
    ├─> internal.callSettings.getActiveCallSettingsForExecutor
    │   └─> ctx.db.query("callSettings")
    │           .withIndex("by_active_and_nextRunAtUTC")
    │           .lte("nextRunAtUTC", currentTime)
    └─> For each setting:
        ├─> internal.service.vapi.executor.calculateAndUpdateNextRun
        │   ├─> cadenceHelpers.calculateNextRunAtUTC()
        │   └─> ctx.db.patch(settingsId, nextRunAtUTC)
        └─> scheduler.runAfter(0, internal.service.vapi.executor.processCallJob)
            └─> processCallJob (action)
                ├─> internal.callJobs.createCallJob
                │   └─> ctx.db.insert("callJobs", status: "queued")
                └─> internal.integrations.vapi.integration.scheduleVapiCall
                    ├─> createVapiClientFromEnv()
                    ├─> vapiClient.createCall() [external API]
                    └─> internal.callJobs.updateCallJobStatus
                        └─> ctx.db.patch(jobId, status: "scheduled", vapiCallId)
```

### Call Completion Flow (VAPI Webhook)

```
HTTP POST /http/vapi-webhook
    ↓
webhooks.handlers.vapi.vapiWebhookHandler
    ├─> Validates Bearer token
    ├─> Parses VAPI event (end-of-call-report)
    ├─> internal.callJobs.getCallJobByVapiId
    ├─> internal.callJobs.updateCallJobStatus (status: "completed")
    ├─> internal.callJobs.updateCallSession
    │   └─> Creates/updates callSessions record
    └─> scheduler.runAfter(0, internal.callDiaryWorkflow.generateDiaryFromCall)
        └─> generateDiaryFromCall (action)
            ├─> createOpenAIClientFromEnv()
            ├─> openaiClient.generateDiary() [external API]
            ├─> internal.diaries.createDiaryInternal
            ├─> internal.callJobs.updateCallSessionMetadata
            └─> scheduler.runAfter(0, internal.callDiaryWorkflow.generateMusicForCallDiary)
                └─> [See Music Generation flow above]
```

### Internal Functions

```
internal.callSettings.getActiveCallSettingsForExecutor (mutation)
  └─> Called by: service.vapi.executor.executeScheduledCalls

internal.callSettings.getCallSettingsById (query)
  └─> Called by: VAPI integration

internal.callJobs.createCallJob (mutation)
  └─> Called by: service.vapi.executor.processCallJob

internal.callJobs.updateCallJobStatus (mutation)
  └─> Called by: webhooks.handlers.vapi, integrations.vapi.integration

internal.callJobs.incrementCallJobAttempts (mutation)
  └─> Called by: VAPI integration (on retries)

internal.callJobs.getCallJobByVapiId (query)
  └─> Called by: webhooks.handlers.vapi

internal.callJobs.getCallJobById (query)
  └─> Called by: VAPI integration

internal.callJobs.getCallSessionByVapiId (query)
  └─> Called by: webhooks.handlers.vapi

internal.callJobs.updateCallSession (mutation)
  └─> Called by: webhooks.handlers.vapi

internal.callJobs.updateCallSessionMetadata (mutation)
  └─> Called by: callDiaryWorkflow.generateDiaryFromCall

internal.service.vapi.executor.executeScheduledCalls (action)
  └─> Called by: crons.interval("call-executor")

internal.service.vapi.executor.calculateAndUpdateNextRun (mutation)
  └─> Called by: service.vapi.executor.executeScheduledCalls

internal.service.vapi.executor.processCallJob (action)
  └─> Called by: service.vapi.executor.executeScheduledCalls

internal.integrations.vapi.integration.scheduleVapiCall (action)
  └─> Called by: service.vapi.executor.processCallJob

internal.callDiaryWorkflow.generateDiaryFromCall (action)
  └─> Called by: webhooks.handlers.vapi

internal.callDiaryWorkflow.generateMusicForCallDiary (action)
  └─> Called by: callDiaryWorkflow.generateDiaryFromCall
```

---

## 8. Webhooks Use Case

### HTTP Endpoints (Root Level)

```
External Services (Clerk, RevenueCat, Suno, VAPI)
    ↓
HTTP POST /http/clerk-webhook
HTTP POST /http/revenuecat-webhook
HTTP POST /http/suno-webhook
HTTP POST /http/vapi-webhook
```

### Dependency Graph

#### Clerk Webhook

```
HTTP POST /http/clerk-webhook
    ↓
webhooks.handlers.clerk.clerkWebhookHandler
    ├─> Validates Svix signature
    ├─> Parses Clerk event (user.created)
    └─> internal.users.createUser
        └─> [See User Management flow]
```

#### RevenueCat Webhook

```
HTTP POST /http/revenuecat-webhook
    ↓
webhooks.handlers.revenuecat.revenueCatWebhookHandler
    ├─> Validates payload
    ├─> Extracts app_user_id (maps to userId)
    ├─> Gets or creates user
    │   └─> internal.users.getUserIdByClerkId OR internal.users.createUser
    └─> internal.revenueCatBilling.updateSubscriptionFromWebhook
        ├─> ctx.db.get(userId)
        ├─> Maps productId → tier, store → platform
        ├─> Determines status from eventType
        ├─> Updates or creates subscriptionStatuses
        │   └─> ctx.db.patch() OR ctx.db.insert()
        └─> Conditionally inserts subscriptionLog
            └─> [Only if state changed or significant event]
```

#### Suno Webhook

```
HTTP POST /http/suno-webhook
    ↓
webhooks.handlers.suno.sunoMusicGenerationCallback
    └─> [See Music Generation Callback Flow above]
```

#### VAPI Webhook

```
HTTP POST /http/vapi-webhook
    ↓
webhooks.handlers.vapi.vapiWebhookHandler
    └─> [See Call Completion Flow above]
```

---

## 9. Scheduled Jobs (Crons)

### Cron Jobs

```
Convex Cron Scheduler
    ↓
1. crons.interval("call-executor", { minutes: 1 })
    └─> internal.service.vapi.executor.executeScheduledCalls
        └─> [See Phone Calls Scheduled Execution Flow above]

2. crons.daily("revenuecat-reconciliation", { hourUTC: 0 })
    └─> internal.revenueCatBilling.reconcileStaleSubscriptions
        ├─> internal.revenueCatBilling.getStaleSubscriptions
        │   └─> ctx.db.query("subscriptionStatuses")
        │           .withIndex("by_lastVerifiedAt")
        │           .lt("lastVerifiedAt", 24h ago)
        └─> For each stale subscription:
            ├─> fetchRevenueCatCustomer() [HTTP call]
            └─> internal.revenueCatBilling.reconcileSingleSubscription
                ├─> ctx.db.get(subscriptionStatusId)
                ├─> Determines status from RC entitlements
                └─> ctx.db.patch(subscriptionId, status) [if changed]
```

---

## Utility Functions (Shared Helpers)

These are imported and used across multiple modules:

```
utils/phoneHelpers.ts
  ├─> isValidE164()
  └─> Used by: callSettings.upsertCallSettings

utils/timezoneHelpers.ts
  ├─> isValidTimezone()
  ├─> isValidTimeOfDay()
  └─> Used by: callSettings.upsertCallSettings

utils/cadenceHelpers.ts
  ├─> isValidCadenceConfig()
  ├─> calculateLocalMinutes()
  ├─> calculateBydayMask()
  ├─> calculateNextRunAtUTC()
  └─> Used by: callSettings, service.vapi.executor

utils/constants/
  ├─> PLAN_CONFIG [billing plans]
  ├─> REVENUECAT_* [RevenueCat mappings]
  ├─> VAPI_* [VAPI constants]
  └─> Used across: billing, revenueCatBilling, integrations

billing.ts (exported helpers)
  ├─> getEffectiveMusicLimit()
  ├─> getPeriodDurationMs()
  └─> Used by: users, usage, revenueCatBilling

integrations/
  ├─> openai/client.ts
  │   └─> Used by: musicActions, callDiaryWorkflow
  ├─> suno/client.ts
  │   └─> Used by: musicActions
  ├─> revenuecat/client.ts
  │   └─> Used by: revenueCatBilling
  └─> vapi/client.ts
      └─> Used by: integrations.vapi.integration

models/webhooks/
  ├─> Types and validators for webhook payloads
  └─> Used by: webhooks handlers
```

---

## Function Type Legend

- **query** - Read-only, publicly accessible
- **mutation** - Write operation, publicly accessible
- **action** - Can call external APIs, publicly accessible
- **internalQuery** - Read-only, internal only
- **internalMutation** - Write operation, internal only
- **internalAction** - External API calls, internal only
- **httpAction** - HTTP endpoint handler

---

## Quick Reference: Which Module for What?

| What You Need | Module to Look At |
|--------------|-------------------|
| User authentication/profile | `users.ts` |
| Create/read/update diary | `diaries.ts` |
| Generate music from diary | `music.ts` → `musicActions.ts` |
| List/delete music tracks | `music.ts` |
| Share music publicly | `sharing.ts` |
| Subscription plans/limits | `billing.ts` |
| Usage tracking | `usage.ts` |
| Configure phone calls | `callSettings.ts` |
| View call history | `callJobs.ts` |
| Webhook handlers | `webhooks/handlers/` |
| Scheduled tasks | `crons.ts` → `service/vapi/executor.ts` |
| RevenueCat integration | `revenueCatBilling.ts` |
| VAPI call scheduling | `integrations/vapi/integration.ts` |

---

## Cross-References

- See [AGENTS.md](../AGENTS.md) for development setup and conventions
- See [ENV_VARS.md](ENV_VARS.md) for required environment variables
- See [SCHEMA.md](SCHEMA.md) for database schema details (if exists)

