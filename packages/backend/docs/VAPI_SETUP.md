# VAPI Integration Setup Guide

This document describes how to set up the VAPI integration for daily outbound calls.

## Overview

The VAPI integration enables daily outbound calls to users based on their configured schedule. Users can set their phone number, timezone, preferred call time, and cadence (daily, weekdays, weekends, or custom days).

## Architecture

### Components

1. **Database Tables** (schema.ts):
   - `callSettings`: User call configuration (phone, timezone, time, cadence)
   - `callJobs`: Scheduled call jobs with status tracking
   - `callSessions`: Call session records with metadata

2. **Backend Modules**:
   - `callSettings.ts`: CRUD operations for call settings
   - `callJobs.ts`: Call job lifecycle management
   - `integrations/vapi/integration.ts`: VAPI API client
   - `dailyPlanner.ts`: Daily scheduling job
   - `timezoneHelpers.ts`: IANA timezone utilities
   - `cadenceHelpers.ts`: Cadence matching logic

3. **Webhooks** (http.ts):
   - `/webhooks/vapi`: Handles call start, completion, and failure events

## Environment Variables

The following environment variables must be configured in the Convex Dashboard:

### Required Variables

#### `VAPI_API_KEY`
- **Description**: API key for authenticating with VAPI
- **Format**: Bearer token string
- **Example**: `sk_live_abc123...`
- **Where to get it**: VAPI Dashboard → Settings → API Keys

#### `CONVEX_SITE_URL` (Automatic)
- **Description**: Site URL of your Convex deployment (automatically provided by Convex)
- **Format**: Automatically set by Convex (e.g., `https://your-deployment.convex.site`)
- **Note**: This variable is **automatically provided by Convex** - you do NOT need to set it manually. The system automatically constructs the full webhook URL by appending `/webhooks/vapi` to this site URL

### Optional Variables

#### `VAPI_WEBHOOK_SECRET`
- **Description**: Secret for verifying VAPI webhook signatures (if supported by VAPI)
- **Format**: String
- **Example**: `whsec_abc123...`

#### `VAPI_ASSISTANT_ID`
- **Description**: Default assistant ID to use for calls
- **Format**: String
- **Example**: `asst_abc123...`
- **Where to get it**: VAPI Dashboard → Assistants

## Setup Instructions

### 1. Configure VAPI Account

1. Sign up for a VAPI account at https://vapi.ai
2. Create an assistant for your outbound calls
3. Configure the assistant's voice, prompt, and behavior
4. Note the Assistant ID

### 2. Set Environment Variables in Convex

1. Go to your Convex Dashboard
2. Navigate to Settings → Environment Variables
3. Add the required environment variables:
   ```
   VAPI_API_KEY=sk_live_your_api_key
   VAPI_ASSISTANT_ID=asst_your_assistant_id
   ```
   **Note:** `CONVEX_SITE_URL` is automatically provided by Convex - no need to set it manually.

### 3. Configure VAPI Webhooks

1. In VAPI Dashboard, go to Settings → Webhooks
2. Add your webhook URL: `https://your-deployment.convex.cloud/webhooks/vapi`
3. Subscribe to the following events:
   - `call.started`
   - `call.ended`
   - `call.failed`

### 4. Daily Planner Cron Job (Automatic)

The daily planner is **automatically configured** to run every day at 00:00 UTC via `convex/crons.ts`.

The cron job:
- Runs `internal.dailyPlanner.runDailyPlanner()` daily at midnight UTC
- Checks all active call settings
- Schedules calls for eligible users based on their cadence and timezone
- No manual configuration required - it's deployed automatically with your Convex backend

**Manual Testing**

To manually trigger the daily planner for testing:
```typescript
// In Convex Dashboard, run:
internal.dailyPlanner.triggerDailyPlanner()
```

**Monitoring Cron Execution**

Check Convex logs for:
- "Starting daily planner job..." - indicates cron ran
- Scheduled/skipped/failed counts
- Any errors during execution

### 5. Deploy Backend

```bash
cd packages/backend
npx convex deploy
```

## Usage

### User Flow

1. User configures call settings via UI:
   - Phone number (E.164 format, e.g., +12125551234)
   - Timezone (IANA, e.g., America/New_York)
   - Time of day (HH:MM 24h format, e.g., 09:00)
   - Cadence (daily, weekdays, weekends, or custom)
   - Active toggle

2. Daily planner runs at 00:00 UTC:
   - Checks if today matches user's cadence in their local timezone
   - Computes UTC timestamp for user's local time
   - If time is in future and no job exists, creates job and schedules with VAPI

3. VAPI calls user at scheduled time:
   - Sends `call.started` webhook → Updates job status to "started"
   - Call completes → Sends `call.ended` webhook → Updates job status to "completed"
   - Call fails → Sends `call.failed` webhook → Updates job status to "failed"

### API Endpoints

#### User-Facing Queries

- `api.callSettings.getCallSettings()`: Get current user's settings
- `api.callJobs.getCallJobs({ limit?, status? })`: Get user's call jobs
- `api.callJobs.getCallJobStats()`: Get job statistics
- `api.callSessions.getCallSessions({ limit? })`: Get call sessions

#### User-Facing Mutations

- `api.callSettings.upsertCallSettings({ phoneE164, timezone, timeOfDay, cadence, daysOfWeek?, active, voiceId? })`: Create/update settings
- `api.callSettings.toggleCallSettings({ active })`: Toggle active status
- `api.callSettings.deleteCallSettings()`: Delete settings and cancel pending jobs
- `api.callJobs.cancelCallJob({ jobId })`: Cancel a scheduled job

#### Internal Functions

- `internal.dailyPlanner.runDailyPlanner()`: Daily scheduling job
- `internal.integrations.vapi.integration.scheduleVapiCall({ jobId, phoneNumber, userId })`: Schedule call with VAPI

## Data Model

### CallSettings

```typescript
{
  userId: Id<"users">,
  phoneE164: string,           // E.164 format: +12125551234
  timezone: string,            // IANA: America/New_York
  timeOfDay: string,           // HH:MM 24h: 09:00
  cadence: "daily" | "weekdays" | "weekends" | "custom",
  daysOfWeek?: number[],       // 0-6 for Sunday-Saturday (custom only)
  active: boolean,
  voiceId?: string,            // For future voice selection
  createdAt: number,
  updatedAt: number,
}
```

### CallJobs

```typescript
{
  userId: Id<"users">,
  callSettingsId: Id<"callSettings">,
  scheduledForUTC: number,     // UTC timestamp
  status: "queued" | "scheduled" | "started" | "completed" | "failed" | "canceled",
  vapiCallId?: string,         // VAPI's call ID
  attempts: number,
  errorMessage?: string,
  createdAt: number,
  updatedAt: number,
}
```

### CallSessions

```typescript
{
  userId: Id<"users">,
  callJobId: Id<"callJobs">,
  vapiCallId: string,
  startedAt: number,
  endedAt?: number,
  durationSec?: number,
  disposition?: string,        // e.g., "completed", "no-answer", "busy"
  metadata?: any,              // Additional VAPI metadata
  createdAt: number,
}
```

## Monitoring

### Dashboard Metrics

The monitoring dashboard should display:

- **Today's Stats**:
  - Scheduled calls
  - Started calls
  - Completed calls
  - Failed calls

- **Per-User Stats**:
  - Total jobs
  - Success rate
  - Last error message
  - Last error timestamp

### Logs

Check Convex logs for:
- Daily planner execution results
- VAPI API errors
- Webhook processing events

## Troubleshooting

### Calls Not Being Scheduled

1. Check if daily planner is running:
   - Look for "Starting daily planner job..." in logs
   - Verify cron job is configured correctly

2. Check user settings:
   - Ensure `active` is `true`
   - Verify timezone is valid IANA timezone
   - Confirm time hasn't already passed for today

3. Check environment variables:
   - `VAPI_API_KEY` is set
   - `CONVEX_SITE_URL` is available (automatically provided by Convex - webhook URL is constructed automatically)

### Webhooks Not Working

1. Verify webhook URL in VAPI Dashboard matches your Convex deployment
2. Check webhook event subscriptions in VAPI Dashboard
3. Look for webhook errors in Convex logs
4. Test webhook manually using curl:
   ```bash
   curl -X POST https://your-deployment.convex.cloud/webhooks/vapi \
     -H "Content-Type: application/json" \
     -d '{"type":"call.started","call":{"id":"test-123"}}'
   ```

### Timezone Issues

1. Verify timezone is valid IANA timezone (e.g., "America/New_York", not "EST")
2. Test timezone conversion:
   ```typescript
   import { localTimeToUTC } from "./utils/timezoneHelpers";
   const utc = localTimeToUTC("09:00", "America/New_York");
   console.log(new Date(utc).toISOString());
   ```

3. Check for DST transitions around the scheduled time

## Phase 1 Limitations

The current implementation (Phase 1) has the following limitations:

- **No Retries**: If a call fails or time passes, it's skipped for that day
- **No Transcripts**: Call transcripts are not stored or processed
- **No Memories**: No memory extraction or personalized prompts
- **No Journals**: No journalization from call content
- **Basic Cadence**: Only daily, weekdays, weekends supported in UI (custom is data-ready)
- **No Voice Selection UI**: Voice selection field exists but no UI yet

These features are planned for future phases.

## Security Considerations

1. **Phone Number Validation**: All phone numbers are validated as E.164 format
2. **User Authorization**: Users can only access their own call settings and jobs
3. **Webhook Verification**: Consider implementing VAPI webhook signature verification
4. **Rate Limiting**: Consider adding rate limits for call scheduling
5. **Consent**: Ensure users consent to outbound calls and recording (if applicable)

## Testing

### Manual Testing

1. Create call settings for a test user
2. Set time to 5 minutes in the future
3. Manually trigger daily planner:
   ```bash
   # In Convex Dashboard, run:
   internal.dailyPlanner.triggerDailyPlanner()
   ```
4. Verify job is created and scheduled with VAPI
5. Wait for scheduled time and verify call is made
6. Check webhook events are processed correctly

### Automated Testing

Run backend tests:
```bash
cd packages/backend
npm test
```

Tests cover:
- Timezone conversions (including DST)
- Cadence matching logic
- E.164 phone validation
- Call job lifecycle
- Webhook processing

## Support

For issues or questions:
1. Check Convex logs for errors
2. Review VAPI Dashboard for call status
3. Verify environment variables are set correctly
4. Contact VAPI support for API-related issues
