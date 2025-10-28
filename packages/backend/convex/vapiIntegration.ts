/**
 * VAPI Integration
 * Handles API calls to VAPI for scheduling and managing outbound calls
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { buildVapiAssistant } from "./service/vapi/helpers";
import { createVapiClientFromEnv } from "./service/vapi/client";

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
    // Create VAPI client with environment configuration
    // This abstracts IO and provides proper timeout handling and type safety
    const vapiClient = createVapiClientFromEnv({
      VAPI_API_KEY: process.env.VAPI_API_KEY,
      VAPI_WEBHOOK_URL: process.env.VAPI_WEBHOOK_URL,
      VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID,
      VAPI_TIMEOUT: process.env.VAPI_TIMEOUT,
    });

    // Get webhook URL from environment for assistant configuration
    const webhookUrl = process.env.VAPI_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("VAPI_WEBHOOK_URL environment variable is not set");
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
      const assistant = buildVapiAssistant(
        user,
        callSettings,
        job.scheduledForUTC,
        webhookUrl
      );

      await ctx.runMutation(internal.callJobs.incrementCallJobAttempts, {
        jobId: args.jobId,
      });

      // Call VAPI using the client service
      // The client handles timeout, error handling, and type safety
      const response = await vapiClient.createCall({
        customer: {
          number: args.phoneNumber,
        },
        assistant,
        metadata: {
          jobId: args.jobId,
          userId: args.userId,
        },
      });

      // Extract call ID from properly typed response
      const vapiCallId = response.id || response.callId;

      if (!vapiCallId) {
        throw new Error("VAPI API did not return a call ID");
      }

      await ctx.runMutation(internal.callJobs.updateCallJobStatus, {
        jobId: args.jobId,
        status: "scheduled",
        vapiCallId: typeof vapiCallId === "string" ? vapiCallId : String(vapiCallId),
      });

      return {
        success: true,
        vapiCallId: typeof vapiCallId === "string" ? vapiCallId : String(vapiCallId),
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
