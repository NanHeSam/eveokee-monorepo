import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    activeSubscriptionId: v.optional(v.id("subscriptionStatuses")),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  subscriptionStatuses: defineTable({
    userId: v.id("users"),
    platform: v.optional(v.union(
      v.literal("app_store"),      // Apple App Store (iOS)
      v.literal("play_store"),      // Google Play Store (Android)
      v.literal("stripe"),          // Stripe (Web)
      v.literal("clerk")            // Clerk-managed (free users)
    )),
    productId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("expired"),
      v.literal("in_grace")
    ),
    subscriptionTier: v.string(),
    lastResetAt: v.number(),
    musicGenerationsUsed: v.number(),
    autoRenewStatus: v.optional(v.union(v.literal("on"), v.literal("off"))),
    latestReceipt: v.optional(v.string()),
    lastVerifiedAt: v.number(),
    expiresAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    // Custom limit override (for manual adjustments)
    customMusicLimit: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_subscriptionTier", ["subscriptionTier"])
    .index("by_lastVerifiedAt", ["lastVerifiedAt"]),

  diaries: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    content: v.string(),
    date: v.number(),
    primaryMusicId: v.optional(v.id("music")),
    updatedAt: v.number(),
    // Memory system extensions
    originalText: v.optional(v.string()),
    version: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_primaryMusicId", ["primaryMusicId"]),

  // Memory System Tables
  events: defineTable({
    userId: v.id("users"),
    diaryId: v.id("diaries"),
    happenedAt: v.number(),
    personIds: v.optional(v.array(v.id("people"))),
    title: v.string(),
    summary: v.string(),
    mood: v.optional(v.union(v.literal(-2), v.literal(-1), v.literal(0), v.literal(1), v.literal(2))),
    arousal: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5))),
    anniversaryCandidate: v.optional(v.boolean()),
    tagIds: v.optional(v.array(v.id("userTags"))),
  })
    .index("by_userId", ["userId"])
    .index("by_diaryId", ["diaryId"])
    .index("by_userId_and_happenedAt", ["userId", "happenedAt"]),

  people: defineTable({
    userId: v.id("users"),
    primaryName: v.string(),
    altNames: v.optional(v.array(v.string())),
    relationshipLabel: v.optional(v.string()),
    lastMentionedAt: v.optional(v.number()),
    interactionCount: v.optional(v.number()),
    highlights: v.optional(v.object({
      summary: v.string(),
      lastGeneratedAt: v.number(),
    })),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_primaryName", ["userId", "primaryName"])
    .index("by_userId_and_lastMentionedAt", ["userId", "lastMentionedAt"])
    .index("by_userId_and_interactionCount", ["userId", "interactionCount"]),

  userTags: defineTable({
    userId: v.id("users"),
    canonicalName: v.string(),
    displayName: v.string(),
    eventCount: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_eventCount", ["userId", "eventCount"])
    .index("by_userId_and_canonicalName", ["userId", "canonicalName"]),

  diaryMedia: defineTable({
    diaryId: v.id("diaries"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("photo"), v.literal("video")),
    contentType: v.string(),
    fileSize: v.number(),
  })
    .index("by_diaryId", ["diaryId"])
    .index("by_userId", ["userId"]),

  music: defineTable({
    userId: v.id("users"),
    diaryId: v.optional(v.id("diaries")),
    taskId: v.optional(v.string()), // For async grouping/idempotency
    musicIndex: v.optional(v.number()), // Index within task: 0 or 1
    audioId: v.optional(v.string()), // Should be unique
    title: v.optional(v.string()),
    lyric: v.optional(v.string()), // Plain text lyrics
    lyricWithTime: v.optional(
      v.object({
        alignedWords: v.array(
          v.object({
            word: v.string(),
            startS: v.number(),
            endS: v.number(),
            palign: v.number(),
          }),
        ),
        waveformData: v.array(v.number()),
        hootCer: v.number(),
      }),
    ),
    duration: v.optional(v.number()), // Duration in seconds
    audioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    primaryVideoId: v.optional(v.id("musicVideos")), // Primary/favorite music video
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    metadata: v.optional(
      v.object({
        data: v.any(),
        id: v.optional(v.string()),
        source_audio_url: v.optional(v.string()),
        stream_audio_url: v.optional(v.string()),
        source_stream_audio_url: v.optional(v.string()),
        source_image_url: v.optional(v.string()),
        model_name: v.optional(v.string()),
        createTime: v.optional(v.number()),
        prompt: v.optional(v.string()),
        tags: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()), // Soft delete
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_musicIndex", ["userId", "musicIndex"])
    .index("by_diaryId", ["diaryId"])
    .index("by_taskId", ["taskId"])
    .index("by_taskId_and_musicIndex", ["taskId", "musicIndex"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_audioId", ["audioId"])
    .index("by_deletedAt", ["deletedAt"])
    .index("by_primaryVideoId", ["primaryVideoId"]),

  musicVideos: defineTable({
    musicId: v.id("music"),
    userId: v.id("users"),
    kieTaskId: v.string(), // Task ID from Kie.ai API for webhook correlation
    videoStorageId: v.optional(v.string()), // Convex storage ID for the video file
    scriptPrompt: v.string(), // Generated script/prompt sent to Kie.ai
    duration: v.optional(v.number()), // Video duration in seconds
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    metadata: v.optional(
      v.object({
        data: v.any(), // Full Kie.ai response data
        videoUrl: v.optional(v.string()), // Original Kie.ai video URL
        model: v.optional(v.string()), // Model used (e.g., "sora-2-text-to-video")
        aspectRatio: v.optional(v.string()), // "portrait" or "landscape"
        nFrames: v.optional(v.string()), // "10" or "15" seconds
        errorMessage: v.optional(v.string()), // Error message when video generation fails
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_musicId", ["musicId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_kieTaskId", ["kieTaskId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  emailNotify: defineTable({
    email: v.string(),
    isAndroidInvite: v.optional(v.boolean()),
    source: v.optional(v.string()),
    androidRequestedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  sharedMusic: defineTable({
    musicId: v.id("music"),
    userId: v.id("users"),
    shareId: v.string(),
    viewCount: v.number(),
    isActive: v.boolean(),
    isPrivate: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_shareId", ["shareId"])
    .index("by_musicId", ["musicId"])
    .index("by_userId", ["userId"])
    .index("by_isActive", ["isActive"])
    .index("by_userId_and_isActive", ["userId", "isActive"]),

  callSettings: defineTable({
    userId: v.id("users"),
    phoneE164: v.string(), // E.164 format phone number
    timezone: v.string(), // IANA timezone (e.g., "America/New_York")
    timeOfDay: v.string(), // HH:MM format in 24h (e.g., "09:00")
    cadence: v.union(
      v.literal("daily"),
      v.literal("weekdays"),
      v.literal("weekends"),
      v.literal("custom")
    ),
    daysOfWeek: v.optional(v.array(v.number())), // 0-6 for Sunday-Saturday (for custom cadence)
    active: v.boolean(),

    // Canonical cadence representation (optional for backward compatibility)
    localMinutes: v.optional(v.number()),        // 0..1439 (HH*60 + MM)
    bydayMask: v.optional(v.number()),           // 7-bit mask: bit0=Sun … bit6=Sat
    nextRunAtUTC: v.optional(v.number()),        // UTC ms of next fire

    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]) // One settings record per user (enforced in upsert logic)
    .index("by_active", ["active"])
    .index("by_phoneE164", ["phoneE164"])
    .index("by_active_and_nextRunAtUTC", ["active", "nextRunAtUTC"]),

  callJobs: defineTable({
    userId: v.id("users"),
    callSettingsId: v.id("callSettings"),
    scheduledForUTC: v.number(), // UTC timestamp for when call should happen
    status: v.union(
      v.literal("queued"),
      v.literal("scheduled"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled")
    ),
    vapiCallId: v.optional(v.string()), // VAPI's call ID
    attempts: v.number(),
    errorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_callSettingsId", ["callSettingsId"])
    .index("by_callSettingsId_and_scheduledForUTC", ["callSettingsId", "scheduledForUTC"])
    .index("by_userId_and_scheduledForUTC", ["userId", "scheduledForUTC"])
    .index("by_status", ["status"])
    .index("by_scheduledForUTC", ["scheduledForUTC"])
    .index("by_vapiCallId", ["vapiCallId"]),

  callSessions: defineTable({
    userId: v.id("users"),
    callJobId: v.id("callJobs"),
    vapiCallId: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    disposition: v.optional(v.string()), // e.g., "completed", "no-answer", "busy"
    metadata: v.optional(v.any()), // Store any additional VAPI metadata
    endOfCallReport: v.optional(v.any()), // Full VAPI end-of-call-report object
  })
    .index("by_userId", ["userId"])
    .index("by_callJobId", ["callJobId"])
    .index("by_vapiCallId", ["vapiCallId"])
    .index("by_userId_and_startedAt", ["userId", "startedAt"]),

  subscriptionLog: defineTable({
    userId: v.id("users"),
    eventType: v.union(
      v.literal("INITIAL_PURCHASE"),
      v.literal("RENEWAL"),
      v.literal("CANCELLATION"),
      v.literal("UNCANCELLATION"),
      v.literal("NON_RENEWING_PURCHASE"),
      v.literal("SUBSCRIPTION_PAUSED"),
      v.literal("EXPIRATION"),
      v.literal("BILLING_ISSUE"),
      v.literal("PRODUCT_CHANGE"),
      v.literal("TRANSFER"),
      v.literal("SUBSCRIPTION_EXTENDED"),
      v.literal("SUBSCRIPTION_EXTENSION_REVOKED"),
      v.literal("SUBSCRIPTION_UNPAUSED"),
      v.literal("SUBSCRIPTION_RESUMED"),
      v.literal("SUBSCRIPTION_REFUNDED"),
      v.literal("INVOICE_ISSUANCE"),
      v.literal("TEST"),
      v.literal("RECONCILIATION")
    ),
    productId: v.string(),
    platform: v.optional(v.union(
      v.literal("app_store"),      // Apple App Store (iOS)
      v.literal("play_store"),      // Google Play Store (Android)
      v.literal("stripe"),          // Stripe (Web)
      v.literal("clerk")            // Clerk-managed (free users)
    )),
    subscriptionTier: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("expired"),
      v.literal("in_grace")
    ),
    expiresAt: v.optional(v.number()),
    purchasedAt: v.optional(v.number()), // From webhook purchased_at_ms
    isTrialConversion: v.optional(v.boolean()), // From webhook is_trial_conversion
    entitlementIds: v.optional(v.array(v.string())), // Array of entitlement IDs
    store: v.optional(v.string()), // Original store from webhook
    environment: v.optional(v.union(v.literal("SANDBOX"), v.literal("PRODUCTION"))), // Receipt environment from webhook
    rawEvent: v.optional(v.any()), // Full RC webhook payload for debugging
    recordedAt: v.number(),
  })
    .index("by_userId_and_recordedAt", ["userId", "recordedAt"])
    .index("by_userId", ["userId"]),

  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // Expo push token
    platform: v.union(
      v.literal("ios"),
      v.literal("android")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  blogPosts: defineTable({
    slug: v.optional(v.string()), // Nullable for drafts, required on publish
    title: v.string(),
    bodyMarkdown: v.string(), // Store markdown directly, not in storage
    excerpt: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    publishedAt: v.optional(v.number()), // Timestamp when published
    author: v.string(),
    tags: v.array(v.string()),
    readingTime: v.optional(v.number()), // Reading time in minutes
    canonicalUrl: v.optional(v.string()),
    featuredImage: v.optional(v.string()), // Featured image URL from RankPill
    redirectFrom: v.optional(v.array(v.string())), // Array of old slugs that redirect here
    draftPreviewToken: v.optional(v.string()), // Token for previewing drafts (for RankPill review flow)
    createdAt: v.optional(v.number()), // DEPRECATED: Use _creationTime instead. Will be removed after migration.
    updatedAt: v.number(), // Use _creationTime for createdAt (provided by Convex)
  })
    .index("by_slug", ["slug"]) // Unique index enforced via logic for non-null slugs
    .index("by_status", ["status"])
    .index("by_publishedAt", ["publishedAt"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"])
    .index("by_draftPreviewToken", ["draftPreviewToken"]),

  blogPostRevisions: defineTable({
    postId: v.id("blogPosts"),
    bodyMarkdown: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    author: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_postId_and_createdAt", ["postId", "createdAt"]),

  blogPostAnalytics: defineTable({
    postId: v.id("blogPosts"),
    date: v.string(), // YYYY-MM-DD format for aggregation
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_date", ["date"])
    .index("by_postId_and_date", ["postId", "date"]),

  userSongs: defineTable({
    userId: v.id("users"),
    musicId: v.id("music"),
    ownershipType: v.union(
      v.literal("owned"),      // User created this music
      v.literal("shared")      // User added this from a share link
    ),
    sharedMusicId: v.optional(v.id("sharedMusic")), // Reference to sharedMusic record if added via share
    linkedFromMusicIndex: v.optional(v.number()), // Music index (0 or 1) - only link index 0 for now
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_musicId", ["userId", "musicId"])
    .index("by_musicId", ["musicId"])
    .index("by_sharedMusicId", ["sharedMusicId"]),

  featureFlags: defineTable({
    flagKey: v.string(),
    allowUserIds: v.array(v.id("users")),
    denyUserIds: v.array(v.id("users")),
    rolloutPercentage: v.number(), // 0-100
  })
    .index("by_flagKey", ["flagKey"]),
});
