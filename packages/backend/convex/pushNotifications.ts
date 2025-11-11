/**
 * Push Notifications Backend
 * Handles push token registration and sending push notifications via Expo Push API
 */

import { mutation, query, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import ensureCurrentUser from "./users";

/**
 * Get push tokens for the current user (for debugging/testing)
 */
export const getMyPushTokens = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pushTokens"),
      token: v.string(),
      platform: v.union(v.literal("ios"), v.literal("android")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);
    
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return tokens.map((token) => ({
      _id: token._id,
      token: token.token,
      platform: token.platform,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    }));
  },
});

/**
 * Register or update a push token for the current user
 * Reassigns existing tokens by value (handles multi-account logins on same device)
 * Allows multiple devices per platform per user
 */
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);
    const now = Date.now();

    // Reassign existing tokens by value (handles multi-account logins)
    const tokenRecord = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (tokenRecord) {
      await ctx.db.patch(tokenRecord._id, {
        userId,
        platform: args.platform,
        updatedAt: now,
      });
      return null;
    }

    // Store new device token (allow multiple devices per user)
    await ctx.db.insert("pushTokens", {
      userId,
      token: args.token,
      platform: args.platform,
      createdAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Unregister a push token (e.g., on logout)
 */
export const unregisterPushToken = mutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);

    // Find and delete the token
    const tokenRecord = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (tokenRecord && tokenRecord.userId === userId) {
      await ctx.db.delete(tokenRecord._id);
    }

    return null;
  },
});

/**
 * Internal query to get all push tokens for a user
 */
export const getUserPushTokens = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pushTokens"),
      token: v.string(),
      platform: v.union(v.literal("ios"), v.literal("android")),
    })
  ),
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return tokens.map((token) => ({
      _id: token._id,
      token: token.token,
      platform: token.platform,
    }));
  },
});

/**
 * Schema validator for notification data payload
 * Matches the NotificationData interface used in the mobile app
 */
const notificationDataValidator = v.optional(
  v.object({
    type: v.union(v.literal("music_ready"), v.literal("video_ready")),
    musicId: v.optional(v.string()),
    videoId: v.optional(v.string()),
    diaryId: v.optional(v.string()),
  })
);

/**
 * Internal mutation to remove invalid push tokens
 * Called when tokens are detected as invalid (DeviceNotRegistered, InvalidCredentials)
 */
export const removeInvalidToken = internalMutation({
  args: {
    tokenId: v.id("pushTokens"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.tokenId);
  },
});

/**
 * Internal action to send push notification via Expo Push API
 * 
 * @param userId - User ID to send notification to
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Additional data payload matching NotificationData interface
 */
export const sendPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: notificationDataValidator,
  },
  returns: v.object({
    success: v.boolean(),
    sentCount: v.number(),
    errors: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args) => {
    // Get all push tokens for the user
    const tokensResult = await ctx.runQuery(
      internal.pushNotifications.getUserPushTokens,
      { userId: args.userId }
    );

    if (tokensResult.length === 0) {
      console.log(`No push tokens found for user ${args.userId}`);
      return {
        success: false,
        sentCount: 0,
        errors: ["No push tokens found for user"],
      };
    }

    // Prepare notification messages for Expo Push API
    const messages = tokensResult.map((token) => ({
      to: token.token,
      sound: "default",
      title: args.title,
      body: args.body,
      data: args.data || {},
    }));

    // Send notifications via Expo Push API
    try {
      // Set up timeout with AbortController
      const controller = new AbortController();
      const timeoutMs = 10000; // 10 seconds timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      let response: Response;
      try {
        response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
          signal: controller.signal,
        });
        // Clear timeout once fetch completes
        clearTimeout(timeoutId);
      } catch (fetchError) {
        // Clear timeout if fetch throws
        clearTimeout(timeoutId);
        
        // Check if this is a timeout/abort error
        if (
          fetchError instanceof Error &&
          fetchError.name === "AbortError"
        ) {
          console.error("Expo Push API request timed out");
          return {
            success: false,
            sentCount: 0,
            errors: ["Expo Push API request timed out"],
          };
        }
        // Re-throw non-timeout errors to be handled by outer catch
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Expo Push API error:", errorText);
        return {
          success: false,
          sentCount: 0,
          errors: [`Expo Push API error: ${errorText}`],
        };
      }

      const result = await response.json() as {
        data?: Array<{ status: string; message?: string; details?: { error?: string } }> | { status: string; message?: string; details?: { error?: string } };
      };
      const receipts = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];

      // Count successful sends and collect errors
      let sentCount = 0;
      const errors: string[] = [];

      receipts.forEach((receipt: any, index: number) => {
        if (receipt.status === "ok") {
          sentCount += 1;
        } else {
          const error = receipt.message || `Unknown error for token ${index}`;
          errors.push(error);
          
          // Schedule token removal for invalid credentials
          if (receipt.details?.error === "DeviceNotRegistered" || 
              receipt.details?.error === "InvalidCredentials") {
            // Schedule mutation to remove invalid token
            ctx.scheduler.runAfter(0, internal.pushNotifications.removeInvalidToken, {
              tokenId: tokensResult[index]._id,
            });
          }
        }
      });

      return {
        success: sentCount > 0,
        sentCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("Failed to send push notification:", error);
      return {
        success: false,
        sentCount: 0,
        errors: [
          error instanceof Error ? error.message : "Unknown error sending notification",
        ],
      };
    }
  },
});

