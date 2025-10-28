/**
 * VAPI Integration
 * Handles API calls to VAPI for scheduling and managing outbound calls
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { buildVapiAssistant } from "./service/vapi/helpers";

/**
 * Schedule a call with VAPI
 * Now uses transient assistant with parameterized system prompt
 */
export const scheduleVapiCall = action({
  args: {
    jobId: v.id("callJobs"),
    phoneNumber: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      throw new Error("VAPI_API_KEY environment variable is not set");
    }

    const webhookUrl = process.env.VAPI_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("VAPI_WEBHOOK_URL environment variable is not set");
    }

    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      throw new Error("VAPI_PHONE_NUMBER_ID environment variable is not set");
    }

    try {
      // Get call job to find call settings
      const job = await ctx.runQuery(internal.callJobs.getCallJobById, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Call job not found");
      }

      // Get user and call settings
      const user = await ctx.runQuery(internal.users.getUserById, {
        userId: args.userId,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const callSettings = await ctx.runQuery(internal.callSettings.getCallSettingsById, {
        settingsId: job.callSettingsId,
      });

      if (!callSettings) {
        throw new Error("Call settings not found");
      }

      // Build transient assistant with user context
      const assistant = buildVapiAssistant(user, callSettings, job.scheduledForUTC);

      await ctx.runMutation(internal.callJobs.incrementCallJobAttempts, {
        jobId: args.jobId,
      });

      // Call immediately (no scheduledFor field)
      const response = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId,
          customer: {
            number: args.phoneNumber,
          },
          assistant,
          metadata: {
            jobId: args.jobId,
            userId: args.userId,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const vapiCallId = data.id || data.callId;

      if (!vapiCallId) {
        throw new Error("VAPI API did not return a call ID");
      }

      await ctx.runMutation(internal.callJobs.updateCallJobStatus, {
        jobId: args.jobId,
        status: "scheduled",
        vapiCallId,
      });

      return {
        success: true,
        vapiCallId,
      };
    } catch (error) {
      console.error("Failed to schedule VAPI call:", error);
      
      await ctx.runMutation(internal.callJobs.updateCallJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Cancel a scheduled VAPI call
 */
export const cancelVapiCall = action({
  args: {
    vapiCallId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      throw new Error("VAPI_API_KEY environment variable is not set");
    }

    try {
      const response = await fetch(`https://api.vapi.ai/call/${args.vapiCallId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to cancel VAPI call:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get call status from VAPI
 */
export const getVapiCallStatus = action({
  args: {
    vapiCallId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      throw new Error("VAPI_API_KEY environment variable is not set");
    }

    try {
      const response = await fetch(`https://api.vapi.ai/call/${args.vapiCallId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      return {
        success: true,
        status: data.status,
        data,
      };
    } catch (error) {
      console.error("Failed to get VAPI call status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
