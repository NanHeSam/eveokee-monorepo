/**
 * VAPI integration helpers
 * Builds assistant objects and formats context for calls
 */

import { Doc } from "../../_generated/dataModel";
import { Vapi } from "@vapi-ai/server-sdk";
import { getSystemPrompt, SystemPromptParams } from "./systemPrompt";
import {
  DEFAULT_VOICE_ID,
  VAPI_TRANSCRIBER_PROVIDER,
  VAPI_MODEL_NAME,
  VAPI_ASSISTANT_NAME,
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
 * @param credentialIds - Optional list of credential IDs to use for the assistant calls
 * @returns A VAPI assistant object using SDK types containing transcriber, model (with system message), voice, messaging defaults, and server configuration (including `url`)
 */
export function buildVapiAssistant(
  user: Doc<"users">,
  callSettings: Doc<"callSettings">,
  scheduledForUTC: number,
  webhookUrl: string,
  credentialIds?: string[]
): Vapi.CreateAssistantDto {
  // Format local time and day
  const localTime = formatLocalTime(scheduledForUTC, callSettings.timezone);
  const dayOfWeek = getDayOfWeekLabel(scheduledForUTC, callSettings.timezone);
  
  // Build system prompt with user context
  const systemPrompt = buildSystemPrompt(
    user.name ?? "there",
    localTime,
    dayOfWeek
  );
  
  // Build transcriber with proper SDK type (DeepgramTranscriber)
  const transcriber: Vapi.DeepgramTranscriber = {
    provider: VAPI_TRANSCRIBER_PROVIDER,
    model: Vapi.DeepgramTranscriberModel.Nova2,
    language: Vapi.DeepgramTranscriberLanguage.En,
  };
  
  // Build model with proper SDK type (OpenAiModel)
  const model: Vapi.OpenAiModel = {
    provider: "openai",
    model: VAPI_MODEL_NAME,
    messages: [
      {
        content: systemPrompt,
        role: "system"
      }
    ],
    tools: [
      {
        type: "endCall",
      }
    ]
  };
  
  // Build voice with proper SDK type (CartesiaVoice)
  const voice: Vapi.CartesiaVoice = {
    provider: "cartesia",
    voiceId: DEFAULT_VOICE_ID,
    model: Vapi.CartesiaVoice.Model.SonicMultilingual,
  };
  
  const assistant: Vapi.CreateAssistantDto = {
    transcriber,
    model,
    voice,
    firstMessage: "",
    firstMessageMode: Vapi.CreateAssistantDto.FirstMessageMode.AssistantSpeaksFirstWithModelGeneratedMessage,
    name: VAPI_ASSISTANT_NAME,
    server: {
      url: webhookUrl,
    },
    serverMessages: [Vapi.CreateAssistantDto.ServerMessages.Item.EndOfCallReport],
    analysisPlan: {
      successEvaluationPlan: {
        rubric: "PassFail",
        messages: [
          {
            role: "system",
            content: `Evaluate whether this call should generate a diary entry and music. 
The call should NOT generate diary/music if:
- It's a voicemail (no real conversation)
- Very brief (< 15 seconds of actual conversation)
- User explicitly says they're "just testing" or testing the system
- Hurried pickup with no meaningful content
- Technical test calls with no personal content

The call SHOULD generate diary/music if:
- Actual conversation about the user's day
- Meaningful moments or experiences shared
- Substantive dialogue beyond greetings
- Personal reflections or events discussed

Respond with "true" if the call should generate diary/music, "false" otherwise.`
          },{
            role: "user",
            content: "Here is the transcript:\n\n{{transcript}}\n\n"
          },{
            role: "user",
            content: "Here was the system prompt of the call:\n\n{{systemPrompt}}\n\n. Here is the ended reason of the call:\n\n{{endedReason}}\n\n"
          }
        ],
        enabled: true,
        timeoutSeconds: 30,
      },
      summaryPlan: {
        messages: [
          {
            role: "system",
            content: `Based on the conversation transcript from this wellness check-in call, create a personal diary entry that:
- Captures the main thoughts, feelings, and experiences shared
- Writes in first person as if the user is writing their own diary
- Maintains an authentic, personal tone
- Focuses on emotional insights and meaningful moments
- Is concise but meaningful (200-400 words)
- Uses the same language as the conversation

Do not mention that this is from a call or conversation. Write as if the user is naturally reflecting on their day.

Format the summary as a diary entry that flows naturally and captures the essence of what was discussed.
However, if the call was a voicemail, then return "Voicemail" and nothing else.`
          },{
            role: "user",
            content: "Here is the transcript:\n\n{{transcript}}\n\n"
          }
        ],
      },
    },
  };

  // Add credentialIds if provided
  if (credentialIds && credentialIds.length > 0) {
    assistant.credentialIds = credentialIds;
  }

  return assistant;
}

