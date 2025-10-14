import { posthogClient } from '../providers/PostHogProvider';

/**
 * Analytics utility for tracking user events and behaviors
 * All tracking is done through PostHog
 */

// ============================================================================
// Session & App Lifecycle Events
// ============================================================================

export const trackAppOpen = () => {
  posthogClient?.capture('app_opened', {
    timestamp: new Date().toISOString(),
  });
};

export const trackAppBackground = () => {
  posthogClient?.capture('app_backgrounded', {
    timestamp: new Date().toISOString(),
  });
};

export const trackAppCrash = (error: Error) => {
  posthogClient?.capture('app_crashed', {
    error_message: error.message,
    error_stack: error.stack,
  });
};

// ============================================================================
// Diary Events
// ============================================================================

export const trackDiaryCreated = (params: {
  diaryId: string;
  contentLength: number;
  hasTitle: boolean;
}) => {
  posthogClient?.capture('diary_created', params);
};

export const trackDiaryUpdated = (params: {
  diaryId: string;
  contentLength: number;
  hasTitle: boolean;
}) => {
  posthogClient?.capture('diary_updated', params);
};

export const trackDiaryDeleted = (params: { diaryId: string }) => {
  posthogClient?.capture('diary_deleted', params);
};

export const trackDiaryViewed = (params: {
  diaryId: string;
  source: 'calendar' | 'list' | 'search';
}) => {
  posthogClient?.capture('diary_viewed', params);
};

// ============================================================================
// Music Generation Events
// ============================================================================

export const trackMusicGenerationStarted = (params: {
  diaryId: string;
  contentLength: number;
}) => {
  posthogClient?.capture('music_generation_started', params);
};

export const trackMusicGenerationCompleted = (params: {
  diaryId: string;
  musicId: string;
  durationMs: number;
}) => {
  posthogClient?.capture('music_generation_completed', params);
};

export const trackMusicGenerationFailed = (params: {
  diaryId: string;
  error: string;
}) => {
  posthogClient?.capture('music_generation_failed', params);
};

// ============================================================================
// Music Playback Events
// ============================================================================

export const trackMusicPlayed = (params: {
  musicId: string;
  diaryId?: string;
  source: 'diary' | 'playlist' | 'mini_player' | 'full_player';
}) => {
  posthogClient?.capture('music_played', params);
};

export const trackMusicPaused = (params: {
  musicId: string;
  playbackPositionMs: number;
  totalDurationMs: number;
}) => {
  posthogClient?.capture('music_paused', params);
};

export const trackMusicCompleted = (params: {
  musicId: string;
  totalDurationMs: number;
}) => {
  posthogClient?.capture('music_completed', params);
};

export const trackMusicSkipped = (params: {
  musicId: string;
  playbackPositionMs: number;
  totalDurationMs: number;
  direction: 'next' | 'previous';
}) => {
  posthogClient?.capture('music_skipped', params);
};

// ============================================================================
// Subscription & Billing Events
// ============================================================================

export const trackPaywallViewed = (params: {
  source: 'music_generation' | 'settings' | 'onboarding';
  reason?: string;
}) => {
  posthogClient?.capture('paywall_viewed', params);
};

export const trackSubscriptionStarted = (params: {
  tier: string;
  platform: 'apple' | 'google' | 'web';
  price?: number;
}) => {
  posthogClient?.capture('subscription_started', params);
};

export const trackSubscriptionCancelled = (params: {
  tier: string;
  platform: 'apple' | 'google' | 'web';
}) => {
  posthogClient?.capture('subscription_cancelled', params);
};

export const trackUsageLimitReached = (params: {
  limitType: 'music_generation' | 'diaries';
  currentUsage: number;
  limit: number;
}) => {
  posthogClient?.capture('usage_limit_reached', params);
};

// ============================================================================
// User Engagement Events
// ============================================================================

export const trackCalendarDateSelected = (params: {
  date: string;
  hasDiary: boolean;
}) => {
  posthogClient?.capture('calendar_date_selected', params);
};

export const trackPlayerExpanded = () => {
  posthogClient?.capture('player_expanded');
};

export const trackPlayerCollapsed = () => {
  posthogClient?.capture('player_collapsed');
};

export const trackSettingsChanged = (params: {
  setting: string;
  value: any;
}) => {
  posthogClient?.capture('settings_changed', params);
};

// ============================================================================
// Authentication Events
// ============================================================================

export const trackSignUpStarted = (params: { method: 'email' | 'oauth' }) => {
  posthogClient?.capture('signup_started', params);
};

export const trackSignUpCompleted = (params: { method: 'email' | 'oauth' }) => {
  posthogClient?.capture('signup_completed', params);
};

export const trackSignInStarted = (params: { method: 'email' | 'oauth' }) => {
  posthogClient?.capture('signin_started', params);
};

export const trackSignInCompleted = (params: { method: 'email' | 'oauth' }) => {
  posthogClient?.capture('signin_completed', params);
};

export const trackSignOut = () => {
  posthogClient?.capture('signout');
};

// ============================================================================
// Error Tracking
// ============================================================================

export const trackError = (params: {
  error_type: string;
  error_message: string;
  error_stack?: string;
  context?: Record<string, any>;
}) => {
  posthogClient?.capture('error', params);
};

// ============================================================================
// Feature Usage Events
// ============================================================================

export const trackFeatureUsed = (params: {
  feature_name: string;
  context?: Record<string, any>;
}) => {
  posthogClient?.capture('feature_used', params);
};

// ============================================================================
// User Properties (for segmentation)
// ============================================================================

export const setUserProperties = async (properties: {
  subscription_tier?: string;
  signup_date?: string;
  total_diaries_created?: number;
  total_music_generated?: number;
  platform?: 'ios' | 'android';
  app_version?: string;
}) => {
  if (!posthogClient) {
    return;
  }

  try {
    const distinctId = await posthogClient.getDistinctId();

    if (!distinctId) {
      return;
    }

    posthogClient.identify(distinctId, properties);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[PostHog] Failed to set user properties', error);
    }
  }
};
