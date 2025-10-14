# PostHog Analytics - Mobile App

## Overview

PostHog is integrated into the mobile app to track user behavior, engagement, and usage metrics. This document outlines the tracking plan and how to use the analytics utilities.

## Setup

### Environment Variables

Add these to your `.env` file:

```bash
EXPO_PUBLIC_POSTHOG_KEY=your_posthog_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Set to 'development', 'preview', or 'production'
EXPO_PUBLIC_ENVIRONMENT=development
```

**Environment Values:**
- `development` - Local development
- `preview` - Testing/preview builds
- `production` - Production builds

This allows you to filter events by environment in PostHog, so dev/test events don't pollute your production analytics.

### Configuration

PostHog is configured in `app/providers/PostHogProvider.tsx` with:
- **Automatic screen tracking**: Captures screen views automatically
- **Session replay**: Records user sessions (with text inputs masked)
- **User identification**: Links events to Clerk user IDs
- **Auto-reset on sign out**: Clears user data when signing out
- **Super properties**: All events automatically include:
  - `environment` - development/preview/production
  - `platform` - ios/android
  - `app_version` - App version from app.json
  - `app_build` - Build number

## Super Properties (Included in All Events)

Every event automatically includes these properties:

| Property | Description | Example Values |
|----------|-------------|----------------|
| `environment` | App environment | `development`, `preview`, `production` |
| `platform` | Operating system | `ios`, `android` |
| `app_version` | App version | `1.0.0` |
| `app_build` | Build number | `1`, `2`, etc. |

These are set once at app initialization and included in every event. Use them to:
- **Filter production events**: `environment = 'production'`
- **Compare platforms**: `platform = 'ios'` vs `platform = 'android'`
- **Track issues by version**: `app_version = '1.0.0'`

## Automatic Tracking

### Screen Views & Time Tracking

The app automatically tracks:

1. **Screen Views**: Every time a user navigates to a new screen
   - Event: `$screen` (PostHog built-in)
   - Properties: `screen_name`, `params`

2. **Time Spent**: Duration spent on each screen
   - Event: `screen_time`
   - Properties:
     - `screen_name`: Name of the screen
     - `time_spent_ms`: Time in milliseconds
     - `time_spent_seconds`: Time in seconds (rounded)

This is handled by `usePostHogNavigation` hook in `app/hooks/usePostHogNavigation.ts`.

### Screens Being Tracked

- **SignIn**: Login screen
- **SignUp**: Registration screen
- **DiaryHome**: Main diary list/calendar
- **DiaryEdit**: Create/edit diary entry
- **Playlist**: Music playlist view
- **Settings**: App settings

## Manual Event Tracking

Use the helper functions from `app/utils/analytics.ts` to track custom events:

```typescript
import { trackDiaryCreated, trackMusicPlayed } from '@/utils/analytics';

// Track diary creation
trackDiaryCreated({
  diaryId: 'diary_123',
  contentLength: 500,
  hasTitle: true,
});

// Track music playback
trackMusicPlayed({
  musicId: 'music_456',
  diaryId: 'diary_123',
  source: 'diary',
});
```

## Event Categories

### 1. Session & App Lifecycle

**Purpose**: Understand overall app usage and stability

| Event | When to Track | Properties |
|-------|--------------|------------|
| `app_opened` | App launches | `timestamp` |
| `app_backgrounded` | App goes to background | `timestamp` |
| `app_crashed` | App crashes | `error_message`, `error_stack` |

**Usage**:
```typescript
import { trackAppOpen, trackAppBackground } from '@/utils/analytics';

// In your app lifecycle hooks
useEffect(() => {
  trackAppOpen();
}, []);
```

### 2. Diary Events

**Purpose**: Track diary creation, editing, and viewing patterns

| Event | When to Track | Properties |
|-------|--------------|------------|
| `diary_created` | New diary saved | `diaryId`, `contentLength`, `hasTitle` |
| `diary_updated` | Existing diary edited | `diaryId`, `contentLength`, `hasTitle` |
| `diary_deleted` | Diary removed | `diaryId` |
| `diary_viewed` | Diary opened | `diaryId`, `source` |

**Example Integration**:
```typescript
// In DiaryEditScreen.tsx
import { trackDiaryCreated, trackDiaryUpdated } from '@/utils/analytics';

const handleSave = async () => {
  const result = await saveDiary(content);

  if (isNewDiary) {
    trackDiaryCreated({
      diaryId: result._id,
      contentLength: content.length,
      hasTitle: !!title,
    });
  } else {
    trackDiaryUpdated({
      diaryId: result._id,
      contentLength: content.length,
      hasTitle: !!title,
    });
  }
};
```

### 3. Music Generation Events

**Purpose**: Monitor music generation success rates and performance

| Event | When to Track | Properties |
|-------|--------------|------------|
| `music_generation_started` | User initiates music gen | `diaryId`, `contentLength` |
| `music_generation_completed` | Music successfully created | `diaryId`, `musicId`, `durationMs` |
| `music_generation_failed` | Generation fails | `diaryId`, `error` |

**Example Integration**:
```typescript
// In useMusicGeneration.ts
import {
  trackMusicGenerationStarted,
  trackMusicGenerationCompleted,
  trackMusicGenerationFailed
} from '@/utils/analytics';

const generateMusic = async (diaryId: string, content: string) => {
  const startTime = Date.now();

  trackMusicGenerationStarted({
    diaryId,
    contentLength: content.length,
  });

  try {
    const music = await musicGenerationAction({ diaryId });

    trackMusicGenerationCompleted({
      diaryId,
      musicId: music._id,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    trackMusicGenerationFailed({
      diaryId,
      error: error.message,
    });
  }
};
```

### 4. Music Playback Events

**Purpose**: Understand listening behavior and engagement

| Event | When to Track | Properties |
|-------|--------------|------------|
| `music_played` | Play button pressed | `musicId`, `diaryId`, `source` |
| `music_paused` | Pause button pressed | `musicId`, `playbackPositionMs`, `totalDurationMs` |
| `music_completed` | Track finishes playing | `musicId`, `totalDurationMs` |
| `music_skipped` | Next/previous track | `musicId`, `playbackPositionMs`, `totalDurationMs`, `direction` |

**Example Integration**:
```typescript
// In TrackPlayerProvider.tsx or MiniPlayer.tsx
import { trackMusicPlayed, trackMusicPaused } from '@/utils/analytics';

const handlePlay = async () => {
  await TrackPlayer.play();

  trackMusicPlayed({
    musicId: currentTrack.id,
    diaryId: currentTrack.diaryId,
    source: 'mini_player',
  });
};

const handlePause = async () => {
  const position = await TrackPlayer.getPosition();
  const duration = await TrackPlayer.getDuration();

  await TrackPlayer.pause();

  trackMusicPaused({
    musicId: currentTrack.id,
    playbackPositionMs: position * 1000,
    totalDurationMs: duration * 1000,
  });
};
```

### 5. Subscription & Billing Events

**Purpose**: Track monetization and conversion funnel

| Event | When to Track | Properties |
|-------|--------------|------------|
| `paywall_viewed` | Paywall shown to user | `source`, `reason` |
| `subscription_started` | User subscribes | `tier`, `platform`, `price` |
| `subscription_cancelled` | User cancels | `tier`, `platform` |
| `usage_limit_reached` | User hits limit | `limitType`, `currentUsage`, `limit` |

**Example Integration**:
```typescript
// In PaywallModal.tsx
import { trackPaywallViewed, trackSubscriptionStarted } from '@/utils/analytics';

useEffect(() => {
  if (isVisible) {
    trackPaywallViewed({
      source: 'music_generation',
      reason: 'limit_reached',
    });
  }
}, [isVisible]);

const handleSubscribe = async (tier: string) => {
  const result = await subscribeToPlan(tier);

  trackSubscriptionStarted({
    tier,
    platform: 'apple',
    price: 9.99,
  });
};
```

### 6. User Engagement Events

**Purpose**: Track micro-interactions and feature usage

| Event | When to Track | Properties |
|-------|--------------|------------|
| `calendar_date_selected` | User clicks calendar date | `date`, `hasDiary` |
| `player_expanded` | User opens full player | - |
| `player_collapsed` | User minimizes player | - |
| `settings_changed` | User changes setting | `setting`, `value` |

### 7. Authentication Events

**Purpose**: Track signup/login funnel

| Event | When to Track | Properties |
|-------|--------------|------------|
| `signup_started` | User begins signup | `method` |
| `signup_completed` | User completes signup | `method` |
| `signin_started` | User begins login | `method` |
| `signin_completed` | User completes login | `method` |
| `signout` | User signs out | - |

## User Properties

Set user properties for segmentation and cohort analysis:

```typescript
import { setUserProperties } from '@/utils/analytics';

// After user signs up or subscription changes
setUserProperties({
  subscription_tier: 'pro',
  signup_date: '2025-10-14',
  total_diaries_created: 10,
  total_music_generated: 5,
  platform: 'ios',
  app_version: '1.0.0',
});
```

These properties allow you to:
- Segment users by subscription tier
- Analyze cohorts by signup date
- Compare behavior between iOS and Android users
- Track engagement over time

## Key Metrics & Dashboards

### Usage Metrics

**Time Spent Metrics**:
- Average session duration (sum of `screen_time` events)
- Time per screen (aggregate `screen_time` by `screen_name`)
- Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)

**Engagement Metrics**:
- Diaries created per user (count `diary_created`)
- Music generation rate (count `music_generation_started`)
- Music listening rate (count `music_played`)
- Average playback completion (compare `music_completed` vs `music_played`)

### Recommended PostHog Dashboards

1. **App Usage Overview**
   - DAU/WAU/MAU trends
   - Average session duration
   - Screen view distribution
   - Top screens by time spent

2. **Diary Engagement**
   - Diaries created over time
   - Average diary length
   - Diary update frequency
   - Most active diary times/days

3. **Music Generation & Playback**
   - Music generation success rate
   - Average generation time
   - Music played per diary
   - Playback completion rate
   - Skip rate and patterns

4. **Monetization Funnel**
   - Paywall view rate
   - Conversion rate by source
   - Subscription tier distribution
   - Churn rate

5. **User Retention**
   - Day 1, 7, 30 retention rates
   - Cohort retention analysis
   - Feature usage by cohort

## PostHog Features to Use

### 1. Session Replay
- Watch real user sessions
- Understand pain points and confusion
- Identify bugs and UX issues

### 2. Funnels
Create conversion funnels:
- Signup flow: `signup_started` → `signup_completed`
- Music generation: `diary_created` → `music_generation_started` → `music_generation_completed` → `music_played`
- Subscription: `paywall_viewed` → `subscription_started`

### 3. User Paths
Analyze common user journeys:
- What screens do users visit after creating a diary?
- What path leads to music generation?
- Where do users drop off?

### 4. Retention Tables
Track user retention:
- Users who created a diary on Day 0, how many returned on Day 7?
- Users who generated music, how many generated again within 30 days?

### 5. Feature Flags (Future)
PostHog supports feature flags for:
- A/B testing new features
- Gradual rollouts
- User segmentation

## Best Practices

### 1. Track Early and Often
Add tracking when building features, not after.

### 2. Be Consistent
Use the helper functions to ensure consistent naming and properties.

### 3. Don't Over-Track
Focus on actionable metrics. Every event should answer a question.

### 4. Test Your Tracking
Before deploying:
```bash
# Enable debug mode in PostHog provider
posthog.debug()
```

### 5. Respect Privacy
- Don't track PII (personally identifiable information)
- Mask sensitive data in session replay
- Follow GDPR/privacy regulations

## Filtering Events by Environment

### In PostHog Insights & Dashboards

When creating insights or dashboards, add a filter:

1. **Filter by production only:**
   - Add filter: `environment` = `production`

2. **Exclude development events:**
   - Add filter: `environment` ≠ `development`

3. **Compare environments:**
   - Add breakdown by `environment`
   - View production vs preview metrics side-by-side

### Example Queries

**Production DAU (Daily Active Users):**
```
Event: Any event
Filter: environment = production
Unique users per day
```

**Screen time by platform (production only):**
```
Event: screen_time
Filter: environment = production
Breakdown by: platform
Aggregate: Sum of time_spent_seconds
```

**Music generation success rate (production vs preview):**
```
Funnel:
1. music_generation_started
2. music_generation_completed

Breakdown by: environment
```

### CI/CD Configuration

Set the environment variable in your build configuration:

**GitHub Actions (for EAS builds):**
```yaml
- name: Build iOS
  env:
    EXPO_PUBLIC_ENVIRONMENT: production
  run: eas build --platform ios --profile production
```

**Local builds:**
```bash
# Development (default)
EXPO_PUBLIC_ENVIRONMENT=development expo start

# Preview
EXPO_PUBLIC_ENVIRONMENT=preview eas build --profile preview

# Production
EXPO_PUBLIC_ENVIRONMENT=production eas build --profile production
```

## Testing Analytics Locally

1. Get your PostHog API key from https://app.posthog.com
2. Add to `.env`:
   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_xxxxx
   EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   EXPO_PUBLIC_ENVIRONMENT=development
   ```
3. Run the app and check PostHog's "Events" tab for incoming events
4. Verify that `environment = development` appears in all events

## Troubleshooting

**Events not showing up?**
- Check that env variables are set
- Verify PostHog client is initialized (check console logs)
- Events may take a few minutes to appear in PostHog

**User not identified?**
- Ensure user is signed in via Clerk
- Check that `PostHogProvider` is inside `ClerkProvider`

**Screen tracking not working?**
- Verify navigation ref is passed to `NavigationContainer`
- Check that `usePostHogNavigation` is called

## Resources

- [PostHog Docs](https://posthog.com/docs)
- [PostHog React Native SDK](https://posthog.com/docs/libraries/react-native)
- [Analytics Best Practices](https://posthog.com/docs/product-analytics/best-practices)
