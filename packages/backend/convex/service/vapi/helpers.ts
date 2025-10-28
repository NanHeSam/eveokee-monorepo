/**
 * VAPI integration helpers
 * Builds assistant objects and formats context for calls
 */

import { Doc, Id } from "../../_generated/dataModel";
import { getSystemPrompt, SystemPromptParams } from "./systemPrompt";

const DEFAULT_VOICE_ID = "d46abd1d-2d02-43e8-819f-51fb652c1c61";

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
    // Fallback to UTC if timezone is invalid
    console.error(`Invalid timezone: ${timezone}`, error);
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

/**
 * Get day of week label from timestamp
 * @param timestamp - UTC timestamp in milliseconds
 * @param timezone - IANA timezone string
 * @returns Day label (e.g., "Monday", "Tuesday", or "Weekend" for Sat/Sun)
 */
export function getDayOfWeekLabel(timestamp: number, timezone: string): string {
  const date = new Date(timestamp);
  
  let dayName: string;
  try {
    // Get the local day name using toLocaleString with 'long' format
    dayName = date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long'
    });
  } catch (error) {
    // Fallback to timezone-agnostic approach using UTC day
    console.error(`Invalid timezone or error in toLocaleString: ${timezone}`, error);
    const utcDay = date.getUTCDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayName = days[utcDay];
  }
  
  // Check if it's a weekend
  if (dayName === 'Saturday' || dayName === 'Sunday') {
    return 'Weekend';
  }
  
  return dayName;
}

/**
 * Build the system prompt with user context
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
 * Build a complete VAPI assistant object
 * @param user - User document
 * @param callSettings - Call settings document
 * @param scheduledForUTC - UTC timestamp when call is scheduled
 * @param webhookUrl - Webhook URL for call events
 * @returns VAPI assistant object
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
    user.name || 'there',
    localTime,
    dayOfWeek
  );
  
  return {
    transcriber: {
      model: "nova-2",
      language: "en",
      provider: "deepgram"
    },
    model: {
      messages: [
        {
          content: systemPrompt,
          role: "system"
        }
      ],
      model: "gpt-4.1",
      provider: "openai"
    },
    voice: {
      voiceId: DEFAULT_VOICE_ID,
      model: "sonic-3",
      provider: "cartesia"
    },
    firstMessage: "",
    firstMessageMode: "assistant-speaks-first-with-model-generated-message",
    name: "eveokee",
    voicemailMessage: "Please call back when you're available.",
    endCallMessage: "Goodbye.",
    server: {
      url: webhookUrl,
    },
  };
}

