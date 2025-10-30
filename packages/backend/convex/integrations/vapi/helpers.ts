/**
 * VAPI integration helpers
 * Builds assistant objects and formats context for calls
 */

import { Doc } from "../../_generated/dataModel";
import { getSystemPrompt, SystemPromptParams } from "./systemPrompt";
import {
  DEFAULT_VOICE_ID,
  VAPI_TRANSCRIBER_MODEL,
  VAPI_TRANSCRIBER_LANGUAGE,
  VAPI_TRANSCRIBER_PROVIDER,
  VAPI_MODEL_NAME,
  VAPI_MODEL_PROVIDER,
  VAPI_VOICE_MODEL,
  VAPI_VOICE_PROVIDER,
  VAPI_FIRST_MESSAGE_MODE,
  VAPI_ASSISTANT_NAME,
  VAPI_VOICEMAIL_MESSAGE,
  VAPI_END_CALL_MESSAGE,
  VAPI_USER_NAME_FALLBACK,
} from "../../utils/constants";

/**
 * Format UTC timestamp to local time string
 * @param timestamp - UTC timestamp in milliseconds
 * @param timezone - IANA timezone string
 * @returns Formatted local time (e.g., "Oct 28, 2025, 09:30 AM")
 */
export function formatLocalTime(timestamp: number, timezone: string): string {
  const date = new Date(timestamp);
  
  try {
    // Use Intl.DateTimeFormat for proper timezone-aware formatting
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return formatter.format(date);
  } catch (error) {
    // Throw a descriptive error for invalid timezone
    console.error(`Invalid timezone: ${timezone}`, error);
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

/**
 * Determine the day-of-week label for a UTC timestamp in a given timezone.
 *
 * @param timestamp - UTC timestamp in milliseconds
 * @param timezone - IANA timezone string
 * @returns `'Weekend'` for Saturday or Sunday, otherwise the weekday name (e.g., `'Monday'`)
 */
export function getDayOfWeekLabel(timestamp: number, timezone: string): string {
  const date = new Date(timestamp);
  
  try {
    // Get the local day name using toLocaleString with 'long' format
    const dayName = date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long'
    });
    
    // Check if it's a weekend
    if (dayName === 'Saturday' || dayName === 'Sunday') {
      return 'Weekend';
    }
    
    return dayName;
  } catch (error) {
    // Throw a descriptive error for invalid timezone
    console.error(`Invalid timezone: ${timezone}`, error);
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

/**
 * Construct a system prompt tailored to the given user context.
 *
 * @param userName - The user's display name to include in the prompt
 * @param localTime - Localized time string for the user (e.g., "Apr 3, 3:30 PM")
 * @param dayOfWeek - Day label for the user (weekday name or "Weekend")
 * @returns A system prompt string that incorporates the provided user context
 */
export function buildSystemPrompt(
  userName: string,
  localTime: string,
  dayOfWeek: string
): string {
  const params: SystemPromptParams = {
    userName,
    localTime,
    dayOfWeek,
  };
  
  return getSystemPrompt(params);
}

/**
 * Construct a VAPI assistant configuration object customized for a scheduled call.
 *
 * @param user - User document; `user.name` is used in the system prompt (falls back to "there" if absent)
 * @param callSettings - Call settings document; `callSettings.timezone` should be an IANA timezone identifier used to localize the scheduled time
 * @param scheduledForUTC - UTC timestamp (milliseconds since epoch) when the call is scheduled
 * @param webhookUrl - URL for the assistant's webhook server to receive call events
 * @returns A VAPI assistant object containing transcriber, model (with system message), voice, messaging defaults, and server configuration (including `url`)
 */
export function buildVapiAssistant(
  user: Doc<"users">,
  callSettings: Doc<"callSettings">,
  scheduledForUTC: number,
  webhookUrl: string
): object {
  // Format local time and day
  const localTime = formatLocalTime(scheduledForUTC, callSettings.timezone);
  const dayOfWeek = getDayOfWeekLabel(scheduledForUTC, callSettings.timezone);
  
  // Build system prompt with user context
  const systemPrompt = buildSystemPrompt(
    user.name || VAPI_USER_NAME_FALLBACK,
    localTime,
    dayOfWeek
  );
  
  return {
    transcriber: {
      model: VAPI_TRANSCRIBER_MODEL,
      language: VAPI_TRANSCRIBER_LANGUAGE,
      provider: VAPI_TRANSCRIBER_PROVIDER
    },
    model: {
      messages: [
        {
          content: systemPrompt,
          role: "system"
        }
      ],
      model: VAPI_MODEL_NAME,
      provider: VAPI_MODEL_PROVIDER
    },
    voice: {
      voiceId: DEFAULT_VOICE_ID,
      model: VAPI_VOICE_MODEL,
      provider: VAPI_VOICE_PROVIDER
    },
    firstMessage: "",
    firstMessageMode: VAPI_FIRST_MESSAGE_MODE,
    name: VAPI_ASSISTANT_NAME,
    voicemailMessage: VAPI_VOICEMAIL_MESSAGE,
    endCallMessage: VAPI_END_CALL_MESSAGE,
    server: {
      url: webhookUrl,
    },
  };
}

