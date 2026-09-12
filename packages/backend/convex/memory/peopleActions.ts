"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { generateRelationshipHighlight } from "./util";
import { wrapModelWithPostHog } from "../utils/posthogWrapper";
import { shutdownPostHog } from "../utils/posthog";
import { AIClient } from "../integrations/ai/client";

/**
 * Generate a relationship highlight for a person
 * This action runs in Node.js to support PostHog LLM analytics
 */
export const generatePersonHighlight = action({
  args: {
    personId: v.id("people"),
  },
  returns: v.object({
    summary: v.string(),
    lastGeneratedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user ID from internal query
    const userResult = await ctx.runQuery(internal.users.getCurrentUserForAction);
    if (!userResult) {
      throw new Error("User not found");
    }
    const userId = userResult.userId;
    
    // Get person details
    const person = await ctx.runQuery(internal.memory.people.getPersonForHighlight, {
      personId: args.personId,
      userId,
    });

    if (!person) {
      throw new Error("Person not found or unauthorized");
    }

    // Get recent events for this person
    const events = await ctx.runQuery(internal.memory.people.getPersonEventsForHighlight, {
      personId: args.personId,
      userId,
    });

    if (events.length === 0) {
      throw new Error("No events found for this person");
    }

    let posthogUsed = false;

    try {
      // Wrap model with PostHog if configured
      let wrappedModel: ReturnType<AIClient["getModel"]> | undefined;
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      if (apiKey) {
        const client = new AIClient({ apiKey });
        const baseModel = client.getModel("openai/gpt-4o-mini");
        const [model, wasWrapped] = wrapModelWithPostHog(baseModel, {
          userId,
          traceId: `person-${args.personId}`,
          operation: "generateRelationshipHighlight",
          modelName: "openai/gpt-4o-mini",
          additionalProperties: {
            personName: person.primaryName,
            eventsCount: events.length,
          },
        });
        wrappedModel = model;
        if (wasWrapped) {
          posthogUsed = true;
        }
      }

      const highlightSummary = await generateRelationshipHighlight(
        person.primaryName,
        events,
        wrappedModel
      );

      // Save to database
      const now = Date.now();
      await ctx.runMutation(internal.memory.people.updatePersonHighlight, {
        personId: args.personId,
        highlights: {
          summary: highlightSummary,
          lastGeneratedAt: now,
        },
      });

      return {
        summary: highlightSummary,
        lastGeneratedAt: now,
      };
    } finally {
      if (posthogUsed) {
        await shutdownPostHog();
      }
    }
  },
});

