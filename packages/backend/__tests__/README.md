# Backend Test Coverage

This directory contains tests for the Convex backend functions. Due to the nature of Convex's server-side runtime, full integration tests require the Convex testing framework.

## Test Scenarios Covered

### Music Generation Flow (`startDiaryMusicGeneration`)

The music generation flow has the following critical paths that should be tested:

1. **Empty Content Validation**
   - Should reject empty or whitespace-only content
   - Ensures diary entries must have meaningful content

2. **Diary Creation vs Update**
   - When `diaryId` is not provided: creates new diary entry
   - When `diaryId` is provided: updates existing diary entry
   - Both paths should trim content and proceed to usage tracking

3. **Usage Limit Enforcement**
   - Before scheduling music generation, checks user's subscription usage
   - If limit is reached: returns failure with `reason` and `remainingQuota`
   - If under limit: increments counter and proceeds
   - Diary is created/updated regardless of limit status

4. **Scheduler Invocation**
   - Only schedules music generation when usage check succeeds
   - Passes complete context: diary data + usage result
   - Uses immediate execution (0ms delay)

### Pending Music Records (`createPendingMusicRecords`)

1. **Input Validation**
   - Rejects non-positive track counts
   - Prevents invalid batch creation

2. **Idempotency**
   - Checks for existing records by `taskId`
   - Returns existing records if found (no duplicates)
   - Creates new records only when `taskId` is new

3. **Record Creation**
   - Creates exact number of records matching `trackCount`
   - Assigns sequential `musicIndex` (0, 1, 2, ...)
   - All records start with status "pending"
   - Timestamps (`createdAt`, `updatedAt`) are set to current time

### Task Completion (`completeSunoTask`)

1. **Missing Records**
   - Returns null when no pending records exist for taskId
   - Logs warning but doesn't throw error

2. **Track-to-Record Mapping**
   - Sorts pending records by `musicIndex` 
   - Maps tracks array to records by position
   - Handles unsorted or incomplete pending sets

3. **Metadata Building**
   - Builds metadata object from track fields
   - Includes: `id`, `source_audio_url`, `stream_audio_url`, `model_name`, etc.
   - Handles optional fields gracefully
   - Parses `createTime` from string or number

4. **Patch Payload Construction**
   - Sets status to "ready" for matched tracks
   - Extracts `audioId`, `audioUrl`, `imageUrl`, `duration`, `title`, `lyric`
   - Full metadata stored in `metadata` field

5. **Missing Tracks**
   - Marks records as "failed" when no corresponding track exists
   - Handles fewer tracks than pending records

6. **Primary Music Promotion**
   - Finds record with `musicIndex === 0`
   - Updates diary's `primaryMusicId` to point to first track
   - Only when track 0 exists and has diaryId

### Subscription Usage Accounting

1. **Period Reset Logic**
   - Calculates period end based on subscription tier
   - Resets `musicGenerationsUsed` to 0 when period expires
   - Updates `lastResetAt` to current time

2. **Usage Recording**
   - Increments `musicGenerationsUsed` counter
   - Returns failure when at or above limit
   - Does not increment when limit reached

3. **Remaining Quota**
   - Calculates as `limit - current usage`
   - Never negative (clamped to 0)
   - Accounts for custom limits if set

4. **Usage Decrementing** (for failed generations)
   - Decrements counter when generation fails
   - Never goes below 0
   - Returns failure if no subscription exists

5. **Snapshot Queries**
   - Returns current usage state with period boundaries
   - Includes tier, status, limits, and quota
   - Returns null for missing users/subscriptions

### HTTP Webhook Handlers

#### Suno Music Generation Callback

1. **Method Validation**
   - Only accepts POST requests
   - Returns 405 for other methods

2. **JSON Parsing**
   - Rejects malformed JSON (400 error)
   - Validates payload structure

3. **Required Fields**
   - Ignores callbacks without `data` field
   - Rejects callbacks without `taskId` (400 error)
   - Handles both `taskId` and `task_id` field names

4. **Callback Type Filtering**
   - Only processes `callbackType === "complete"`
   - Ignores "processing", "pending", etc.

5. **Task Completion**
   - Calls `completeSunoTask` mutation with tracks
   - Returns 500 on mutation failure

#### Clerk User Webhook

1. **Method & Signature Validation**
   - Only accepts POST requests
   - Verifies webhook signature using Clerk SDK
   - Returns 401 on signature failure

2. **Event Filtering**
   - Only processes `user.created` events
   - Ignores other event types

3. **Email Extraction**
   - Uses `primary_email_address_id` to find primary email
   - Falls back to first email in array
   - Handles missing email addresses

4. **Name Building**
   - Concatenates `first_name` and `last_name`
   - Filters out empty values
   - Falls back to username

5. **User Creation**
   - Calls `createUser` mutation with extracted data
   - Adds "alpha-user" tag
   - Calls `createAlphaSubscription` with returned userId
   - Returns 500 on failure

### Web Audio Player

#### useAudioManager Hook

1. **Initialization**
   - Starts with null audio, not playing
   - All state values at defaults

2. **Audio Element Lifecycle**
   - Creates HTMLAudioElement when playing
   - Cleans up on track switch
   - Removes event listeners on unmount

3. **Play/Pause**
   - `playAudio`: creates/resumes audio
   - `pauseAudio`: pauses current audio
   - `toggleAudio`: switches between play/pause

4. **Loading States**
   - Sets loading on `loadstart` event
   - Clears loading on `canplay` event
   - Shows error on play failure

5. **Progress Tracking**
   - Updates `currentTime` on `timeupdate` event
   - Updates `duration` on `loadedmetadata` event
   - Supports seeking with `seekTo`

6. **Seek Clamping**
   - Clamps seek time to [0, duration]
   - Prevents invalid time positions

7. **Track Switching**
   - Stops previous audio when switching
   - Creates new Audio element for different track
   - Reuses element for same track

8. **Error Handling**
   - Catches play failures
   - Handles audio load errors
   - Resets state on error

9. **Audio End**
   - Resets state when audio ends
   - Clears current track

#### MusicPlayer Component

1. **Button State**
   - Shows Play icon when not playing
   - Shows Pause icon when playing
   - Shows spinner when loading
   - Disables button during loading

2. **Progress Display**
   - Formats time as MM:SS
   - Shows current time for playing track
   - Shows 0:00 for non-playing tracks

3. **Progress Bar**
   - Visual representation of playback progress
   - Calculates percentage from currentTime/duration
   - Updates in real-time

4. **Click to Seek**
   - Calculates position from click coordinates
   - Only works for current audio
   - Calls `seekTo` on audio manager

5. **Drag to Seek**
   - Tracks drag state
   - Updates progress during drag
   - Commits seek on release
   - Handles global mouse events

6. **Drag Handle**
   - Only visible for current audio
   - Scales on hover and drag
   - Positioned at current progress

## Running Tests

For web app tests:
```bash
cd apps/web
pnpm test
```

For backend tests with Convex:
```bash
cd packages/backend
npx convex deploy --cmd 'npx convex test'
```

## Integration Testing

Full integration tests for backend mutations/actions should be performed using Convex's testing framework in a deployed environment, as these functions rely on the Convex runtime.

## Manual Testing Checklist

### Music Generation
- [ ] Create new diary and generate music
- [ ] Update diary and regenerate music
- [ ] Try generating when at usage limit
- [ ] Verify usage counter increments
- [ ] Check scheduler is invoked

### Webhooks
- [ ] Send Suno completion callback
- [ ] Send Clerk user.created event
- [ ] Verify proper rejection of invalid requests

### Audio Player
- [ ] Play/pause different tracks
- [ ] Seek by clicking progress bar
- [ ] Drag progress bar to seek
- [ ] Switch between tracks rapidly
- [ ] Check loading states
