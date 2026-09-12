"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { extractEventsFromDiary } from "./memory/util";
import { wrapModelWithPostHog } from "./utils/posthogWrapper";
import { shutdownPostHog } from "./utils/posthog";
import { AIClient } from "./integrations/ai/client";

/**
 * Process a diary entry to extract events
 * This action runs in Node.js to support PostHog LLM analytics
 */
export const processDiaryEntry = internalAction({
  args: {
    diaryId: v.id("diaries"),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.diaries.getDiaryContext, {
      diaryId: args.diaryId,
    });

    if (!context || !context.diary) {
      console.warn(`Diary ${args.diaryId} not found during processing`);
      return;
    }

    const { diary, existingPeople, existingTags } = context;

    let posthogUsed = false;
    try {
      // Wrap model with PostHog if configured
      let wrappedModel: ReturnType<AIClient["getModel"]> | undefined;
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      if (apiKey) {
        const client = new AIClient({ apiKey });
        const baseModel = client.getModel("google/gemini-3-pro-preview");
        const [model, wasWrapped] = wrapModelWithPostHog(baseModel, {
          userId: diary.userId,
          traceId: `diary-${args.diaryId}`,
          operation: "extractEventsFromDiary",
          modelName: "google/gemini-3-pro-preview",
          additionalProperties: {
            diaryDate: new Date(diary.date).toISOString(),
            existingPeopleCount: existingPeople.length,
            existingTagsCount: existingTags.length,
          },
        });
        wrappedModel = model;
        if (wasWrapped) {
          posthogUsed = true;
        }
      }

      const extractedEvents = await extractEventsFromDiary(
        diary.content,
        diary.date,
        existingPeople,
        existingTags,
        wrappedModel
      );

      await ctx.runMutation(internal.diaries.saveDiaryEvents, {
        diaryId: args.diaryId,
        extractedEvents,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(
        `Failed to process diary ${args.diaryId}: ${errorMessage}`,
        errorStack ? `\nStack: ${errorStack}` : ""
      );

      return { success: false, error: errorMessage };
    } finally {
      if (posthogUsed) {
        await shutdownPostHog();
      }
    }
  },
});

