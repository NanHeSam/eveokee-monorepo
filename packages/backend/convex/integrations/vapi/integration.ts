/**
 * VAPI Integration
 * Handles API calls to VAPI for scheduling and managing outbound calls
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { buildVapiAssistant } from "./helpers";
import { createVapiClientFromEnv } from "./client";

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
  returns: v.union(
    v.object({
      success: v.literal(true),
      vapiCallId: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args): Promise<{ success: true; vapiCallId: string } | { success: false; error: string }> => {
    // Create VAPI client with environment configuration
    // This abstracts IO and provides proper timeout handling and type safety
    // CONVEX_SITE_URL is provided automatically by Convex
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
    }
    const vapiClient = createVapiClientFromEnv({
      VAPI_API_KEY: process.env.VAPI_API_KEY,
      CONVEX_SITE_URL: convexSiteUrl,
      WEBHOOK_PATH: "/webhooks/vapi",
      VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID,
      VAPI_TIMEOUT: process.env.VAPI_TIMEOUT,
    });

    // Get webhook URL from client (already constructed from CONVEX_SITE_URL + path)
    const webhookUrl = vapiClient.getWebhookUrl();

    // Parse optional credentialId from environment variable (single credential ID wrapped in array)
    const credentialId = process.env.VAPI_CREDENTIAL_ID;
    const credentialIds = credentialId ? [credentialId] : undefined;

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
        webhookUrl,
        credentialIds
      );

      await ctx.runMutation(internal.callJobs.incrementCallJobAttempts, {
        jobId: args.jobId,
      });

      // Call VAPI using the client service
      // The client handles timeout, error handling, and type safety
      const call = await vapiClient.createCall({
        customer: {
          number: args.phoneNumber,
        },
        assistant,
        metadata: {
          jobId: args.jobId,
          userId: args.userId,
        },
      });

      // Extract call ID from properly typed response (SDK guarantees id is a string)
      const vapiCallId = call.id;

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

